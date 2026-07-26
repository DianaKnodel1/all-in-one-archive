#!/usr/bin/env bash
# =============================================================================
#  fix-mail-crons.sh — repariert die Mail-/Reminder-Crons auf dem Backend
# =============================================================================
#  Behebt:
#    1) Cron-Jobs mit unersetztem <SUPABASE_URL>-Platzhalter → echte URL
#    2) Doppelt registrierten Job send-reminders-hourly (kaputtes Duplikat weg)
#    3) Fehlende Spalte tenants.smtp_health_status
#
#  Verwendung (vom Portal-Server aus, nutzt scripts/backend-server.env):
#      bash scripts/fix-mail-crons.sh
#  Direkt auf dem Backend-Server:
#      bash scripts/fix-mail-crons.sh --local
#  Mit direkter DB-URL:
#      TARGET_DB_URL="postgresql://..." bash scripts/fix-mail-crons.sh
#
#  Ziel-URL überschreibbar:  API_URL="https://api.mb-portal.com" bash ...
# =============================================================================
set -uo pipefail

MODE="${1:-}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONF_FILE="$REPO_DIR/scripts/backend-server.env"
[ -f "$CONF_FILE" ] && . "$CONF_FILE"

: "${BACKEND_USER:=root}"
: "${BACKEND_DB_CONTAINER:=supabase-db}"
: "${BACKEND_DB_USER:=postgres}"
: "${BACKEND_DB_NAME:=postgres}"
: "${API_URL:=https://api.mb-portal.com}"

# Host ohne Schema — die Cron-Kommandos bauen 'https://<SUPABASE_URL>/functions/v1/...'
API_HOST="${API_URL#https://}"
API_HOST="${API_HOST#http://}"
API_HOST="${API_HOST%/}"

log() { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }

if [ -n "${TARGET_DB_URL:-}" ]; then RUNNER="url"
elif [ "$MODE" = "--local" ]; then RUNNER="docker"
elif [ -n "${BACKEND_HOST:-}" ]; then RUNNER="ssh"
else
  echo "✗ Keine Verbindung konfiguriert (TARGET_DB_URL, --local oder BACKEND_HOST)." >&2
  exit 1
fi

sql() {
  local q="$1"
  case "$RUNNER" in
    url)    psql "$TARGET_DB_URL" -v ON_ERROR_STOP=0 -P pager=off -c "$q" 2>&1 ;;
    docker) docker exec -i "$BACKEND_DB_CONTAINER" psql -U "$BACKEND_DB_USER" -d "$BACKEND_DB_NAME" -v ON_ERROR_STOP=0 -P pager=off -c "$q" 2>&1 ;;
    ssh)    ssh -o StrictHostKeyChecking=accept-new "${BACKEND_USER}@${BACKEND_HOST}" \
              "docker exec -i $BACKEND_DB_CONTAINER psql -U $BACKEND_DB_USER -d $BACKEND_DB_NAME -v ON_ERROR_STOP=0 -P pager=off -c \"${q//\"/\\\"}\"" 2>&1 ;;
  esac
}

echo "=============================================================="
echo " Mail-Cron-Reparatur   Ziel-Host: $API_HOST   Modus: $RUNNER"
echo "=============================================================="

# --- 1) Kaputte Duplikate entfernen -----------------------------------------
log "1/4  Doppelte Jobs mit Platzhalter entfernen"
sql "DO \$\$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT j.jobid, j.jobname FROM cron.job j
     WHERE j.command LIKE '%<SUPABASE_URL>%'
       AND EXISTS (SELECT 1 FROM cron.job k
                    WHERE k.jobname = j.jobname AND k.jobid <> j.jobid
                      AND k.command NOT LIKE '%<SUPABASE_URL>%')
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'entfernt: % (jobid %)', r.jobname, r.jobid;
  END LOOP;
END\$\$;"

# --- 2) Restliche Platzhalter ersetzen --------------------------------------
log "2/4  Platzhalter <SUPABASE_URL> durch echten Host ersetzen"
sql "UPDATE cron.job
        SET command = replace(command, '<SUPABASE_URL>', '${API_HOST}')
      WHERE command LIKE '%<SUPABASE_URL>%';"

# --- 3) Fehlende Spalte ------------------------------------------------------
log "3/4  tenants.smtp_health_status sicherstellen"
sql "ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS smtp_health_status text;
     NOTIFY pgrst, 'reload schema';"

# --- 4) Kontrolle ------------------------------------------------------------
log "4/4  Kontrolle"
sql "SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;"
sql "SELECT jobname, count(*) AS anzahl FROM cron.job GROUP BY jobname HAVING count(*) > 1;"
sql "SELECT jobname FROM cron.job WHERE command LIKE '%<SUPABASE_URL>%' OR command LIKE '%<SERVICE_ROLE_KEY>%';"

echo
echo "Fertig. Die beiden letzten Abfragen muessen LEER sein."
echo "Danach ca. 30 Min warten und 'bash scripts/check-mail-health.sh' erneut laufen lassen."