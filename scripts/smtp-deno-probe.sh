#!/usr/bin/env bash
# =============================================================================
#  smtp-deno-probe.sh — reproduziert den SMTP-Login GENAU so wie die Edge
#  Function (Deno + nodemailer) und zeigt zusaetzlich, ob das gespeicherte
#  Passwort/Benutzername unsichtbare Zeichen enthaelt (Copy&Paste-Fehler).
#
#  NUR auf dem Backend-Server ausfuehren:
#     bash scripts/smtp-deno-probe.sh "LH"
# =============================================================================
set -uo pipefail
FILTER="${1:-}"
DB_CONTAINER="${BACKEND_DB_CONTAINER:-supabase-db}"
DB_USER="${BACKEND_DB_USER:-supabase_admin}"
DB_NAME="${BACKEND_DB_NAME:-postgres}"

FN_CONTAINER="$(docker ps --format '{{.Names}}' | grep -Ei 'edge|functions' | head -1)"
[ -z "$FN_CONTAINER" ] && { echo "x Kein Edge-Functions-Container gefunden."; exit 1; }
echo "Edge-Container: $FN_CONTAINER"
echo

WHERE="TRUE"
[ -n "$FILTER" ] && WHERE="name ILIKE '%$FILTER%'"

echo "== 1) Gespeicherte Zugangsdaten auf unsichtbare Zeichen pruefen =="
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -P pager=off -c "
SELECT name,
       smtp_host, smtp_port,
       smtp_username,
       length(smtp_username) AS user_len,
       (smtp_username <> btrim(smtp_username)) AS user_has_spaces,
       length(smtp_password) AS pw_len,
       (smtp_password <> btrim(smtp_password)) AS pw_has_spaces,
       (smtp_password ~ '[^\x20-\x7E]') AS pw_has_weird_chars,
       encode(convert_to(left(smtp_password,2),'UTF8'),'hex') AS pw_first2_hex,
       encode(convert_to(right(smtp_password,2),'UTF8'),'hex') AS pw_last2_hex
FROM tenants WHERE $WHERE;"
echo

echo "== 2) Login-Test aus dem Edge-Container (identisch zur Edge Function) =="
ROWS="$(docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -At -F '|' -P pager=off -c \
  "SELECT name, smtp_host, smtp_port, smtp_username, smtp_password, sender_email
   FROM tenants WHERE $WHERE AND smtp_host IS NOT NULL AND smtp_password IS NOT NULL;")"
[ -z "$ROWS" ] && { echo "  (keine Tenants mit SMTP-Daten gefunden)"; exit 0; }

while IFS='|' read -r NAME HOST PORT USER PASS SENDER; do
  [ -z "$HOST" ] && continue
  echo "--- $NAME  ($USER @ $HOST:$PORT) ---"
  if [ -n "$SENDER" ] && [ -n "$USER" ] && [ "$SENDER" != "$USER" ]; then
    echo "  Hinweis: Absender ($SENDER) weicht vom SMTP-Login ($USER) ab."
  fi
  docker exec -i \
    -e P_HOST="$HOST" -e P_PORT="$PORT" -e P_USER="$USER" -e P_PASS="$PASS" \
    "$FN_CONTAINER" sh -lc '
set -u
EDGE_BIN="$(command -v edge-runtime || command -v /usr/local/bin/edge-runtime || true)"
if [ -z "$EDGE_BIN" ]; then
  echo "  edge-runtime: NICHT-GEFUNDEN"
  exit 0
fi
echo "  runtime: $($EDGE_BIN --version 2>&1 | tr "\n" " " | sed "s/[[:space:]]*$//")"

MAIN_DIR="$(mktemp -d /tmp/smtp-probe-main.XXXXXX)"
PORT_NUM="${PROBE_PORT:-9997}"
cat > "$MAIN_DIR/index.ts" <<TS
import nodemailer from "https://esm.sh/nodemailer@6.9.14";

const host = Deno.env.get("P_HOST") ?? "";
const configuredPort = Number(Deno.env.get("P_PORT") ?? "587");
const user = Deno.env.get("P_USER") ?? "";
const pass = Deno.env.get("P_PASS") ?? "";
const ports = [...new Set([configuredPort, configuredPort === 587 ? 465 : 587])];

function classify(message: string) {
  const m = message.toLowerCase();
  if (m.includes("535") || m.includes("auth") || m.includes("login")) return "AUTH_ERROR";
  if (m.includes("timeout") || m.includes("etimedout")) return "TIMEOUT";
  if (m.includes("econnrefused") || m.includes("connection refused")) return "CONNECTION_REFUSED";
  if (m.includes("enotfound") || m.includes("getaddrinfo")) return "DNS_ERROR";
  if (m.includes("certificate") || m.includes("tls") || m.includes("ssl")) return "TLS_ERROR";
  return "SMTP_ERROR";
}

Deno.serve({ port: Number(Deno.env.get("PROBE_HTTP_PORT") ?? "9997"), hostname: "127.0.0.1" }, async () => {
  const results = [];
  for (const p of ports) {
    const transporter = nodemailer.createTransport({
      host,
      port: p,
      secure: p === 465,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    try {
      await Promise.race([
        transporter.verify(),
        new Promise((_resolve, reject) => setTimeout(() => reject(new Error("verify timeout 12s")), 12000)),
      ]);
      results.push({ port: p, secure: p === 465, ok: true });
    } catch (err) {
      const message = String((err as Error)?.message ?? err);
      results.push({ port: p, secure: p === 465, ok: false, code: classify(message), message });
    }
  }
  return new Response(JSON.stringify({ ok: true, results }), { headers: { "content-type": "application/json" } });
});
TS

LOG_FILE="/tmp/smtp-probe-edge-runtime.log"
rm -f "$LOG_FILE"
PROBE_HTTP_PORT="$PORT_NUM" "$EDGE_BIN" start --main-service "$MAIN_DIR" -p "$PORT_NUM" >"$LOG_FILE" 2>&1 &
PID="$!"
cleanup() { kill "$PID" >/dev/null 2>&1 || true; rm -rf "$MAIN_DIR"; }
trap cleanup EXIT

http_get() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time 35 "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -T 35 -O - "$1"
  else
    echo "NO_HTTP_CLIENT"
    return 127
  fi
}

ready=0
for i in $(seq 1 25); do
  if http_get "http://127.0.0.1:$PORT_NUM/_internal/health" >/dev/null 2>&1; then ready=1; break; fi
  if ! kill -0 "$PID" >/dev/null 2>&1; then break; fi
  sleep 0.2
done

if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
  echo "  FEHLER: Im Edge-Container fehlt curl/wget für den lokalen Probe-Aufruf."
  exit 0
fi

if [ "$ready" != "1" ]; then
  echo "  Edge-Probe konnte nicht starten. Runtime-Log:"
  tail -30 "$LOG_FILE" | sed "s/^/    /"
  exit 0
fi

RESP="$(http_get "http://127.0.0.1:$PORT_NUM/probe" 2>&1 || true)"
if [ -z "$RESP" ]; then
  echo "  FEHLER: keine Antwort vom Probe-Service"
  tail -30 "$LOG_FILE" | sed "s/^/    /"
elif command -v python3 >/dev/null 2>&1; then
  printf "%s" "$RESP" | python3 -c '\''
import json, sys
try:
    payload = json.load(sys.stdin)
except Exception:
    print("  FEHLER: unlesbare Antwort")
    sys.exit(0)
for r in payload.get("results", []):
    port = r.get("port")
    mode = "SSL" if r.get("secure") else "STARTTLS"
    if r.get("ok"):
        print(f"  Port {port} ({mode}): LOGIN OK")
    else:
        print(f"  Port {port} ({mode}): FEHLER [{r.get('code')}] -> {r.get('message')}")
'\''
else
  echo "  Rohantwort: $RESP"
fi'
  echo
done <<< "$ROWS"

echo "Fertig. Deutung:"
echo "  * 535 auth failed  -> Zugangsdaten/Postfach-Freigabe beim Provider (nicht der Code)."
echo "  * timeout/ECONN    -> Der Edge-Container kommt nicht raus (Firewall/Docker-Netz)."
echo "  * pw_has_spaces=t oder pw_has_weird_chars=t -> Passwort wurde falsch eingefuegt."
