## Ausgangslage

Auf `uwkconsulting` läuft **Caddy** (aktiv, mit Drop-In-Override), aber **kein `landing.service`** und **kein `/opt/apps`**. Die Landing Pages werden dort also aktuell nicht vom dynamischen Renderer aus diesem Repo ausgeliefert, sondern vermutlich als statische Dateien oder über eine ältere Installation an einem anderen Pfad. Wo genau, sagt uns die Caddy-Konfiguration.

Parallel blockiert ein Build-Fehler das Deployment: `src/start.ts` enthält wieder `attachSupabaseAuth`, der Auth-Guard stoppt darum jeden Build.

## Schritt 1 — Herausfinden, wo die Landing Pages liegen

Diese Befehle auf `uwkconsulting` ausführen und die Ausgabe zurückschicken:

```bash
cat /etc/caddy/Caddyfile
ls /etc/caddy/ /etc/systemd/system/caddy.service.d/
systemctl cat caddy --no-pager | head -30
ls -la /var/www /srv /opt /home 2>/dev/null
ss -tlnp | grep -E '80|443|3001|3000'
```

Die Caddyfile verrät alles: Steht dort `root * /var/www/...` + `file_server`, sind es **statische Seiten** in diesem Verzeichnis. Steht dort `reverse_proxy 127.0.0.1:<port>`, läuft schon ein Renderer-Prozess, den `ss -tlnp` sichtbar macht.

## Schritt 2 — Entscheidung je nach Fund

```text
Statische Dateien gefunden
  → bestehende Seiten bleiben unangetastet
  → Renderer parallel auf 127.0.0.1:3001 installieren
  → Caddyfile Schritt für Schritt umstellen (erst eine Testdomain)

Fremder Renderer auf einem Port
  → prüfen, ob es eine ältere Version dieses Repos ist
  → wenn ja: am gefundenen Pfad aktualisieren statt neu installieren
  → wenn nein: sauber danebenstellen, keine laufende Auslieferung anfassen

Wirklich nichts Passendes
  → Neuinstallation per setup.sh nach /opt/apps/landing-server
```

In allen Fällen gilt: Das vorhandene Caddy wird **nicht überschrieben**, bevor klar ist, was es bedient — sonst gehen die aktuell live laufenden Landing Pages offline.

## Schritt 3 — Heartbeat-Agent aktivieren

Unabhängig vom Renderer-Pfad braucht der Server den Agent, damit er im Portal nicht mehr „Offline" anzeigt. Er braucht nur den Bootstrap-Token aus `/admin/infrastructure` und meldet dann minütlich Status und Renderer-Gesundheit.

## Schritt 4 — Build-Blocker beheben

`src/start.ts` wird auf `functionMiddleware: [attachSupabaseBearer]` zurückgesetzt und der `attachSupabaseAuth`-Import entfernt, damit `deploy.sh` wieder durchläuft. Anschließend Verifikation mit `node scripts/ensure-auth-middleware.mjs`.

## Technische Details

- Der Renderer (`landing-server/server.js`) lauscht auf `127.0.0.1:3001`, liest Landing-Daten live aus der Datenbank und Themes vom Portal; ein Theme-Resync ist nur ein Cache-Flush.
- `setup.sh` legt `landing.service`, `landing-agent.service` und eine Catch-All-Caddyfile mit `on_demand_tls` an — Letztere würde eine bestehende Konfiguration ersetzen, deshalb erst nach Schritt 1 anwenden.
- Benötigte Werte: `SUPABASE_URL=https://api.mb-portal.com`, der ANON-Key vom Backend-Server, `PORTAL_API_ENDPOINT`, `ACME_EMAIL` sowie der Server-Token aus dem Portal.

## Was ich brauche

Die Ausgabe der Befehle aus Schritt 1 — danach steht fest, ob wir migrieren oder frisch installieren, und ich passe den Plan entsprechend an.
