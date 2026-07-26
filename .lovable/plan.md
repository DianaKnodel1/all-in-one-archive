## Was gerade passiert ist

Zwei getrennte Dinge:

1. **Die Befehle liefen auf dem falschen Server.** Du warst auf `backendserver` (dort liegt Supabase, kein Portal-Repo) — daher `No such file or directory` und `command not found`. Das `401` am Ende ist eine Folgewirkung: ohne `.env.server` war die `key=`-Variable leer, der Aufruf ging also ohne Secret raus. Das sagt nichts über den echten Zustand aus.
2. **`src/start.ts` enthält wieder `attachSupabaseAuth`** (Zeile 6 und 25). Der Prebuild-Guard `scripts/ensure-auth-middleware.mjs` verlangt ausschließlich `attachSupabaseBearer` und bricht den Build ab — sowohl hier in Lovable als auch beim Deploy auf dem Server.

Der Service-Role-Key hast du jetzt aber — genau den braucht `/api/public/domain-health-cron`, weil die Route `supabaseAdmin` lädt (`src/integrations/supabase/client.server.ts` wirft ohne `SUPABASE_SERVICE_ROLE_KEY`). Das erklärt das vorherige HTTP 500 nach dem behobenen 401.

## Änderung im Code

- `src/start.ts`: Import und Eintrag von `attachSupabaseAuth` entfernen, sodass nur `functionMiddleware: [attachSupabaseBearer]` bleibt. Damit läuft der Prebuild-Guard wieder durch.

## Danach auf dem Server (Portal-Server `host-190-97-167-124`, nicht Backend!)

```bash
cd /opt/apps/portal && git pull

# Service-Role-Key eintragen (Wert vom Backend-Server, den du schon hast)
grep -q SUPABASE_SERVICE_ROLE_KEY .env.server || cat >> .env.server <<'EOF'
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzcwNjgwMDAsImV4cCI6MTkzNDgzNDQwMH0.4lyCBv845jQVTfSPsDRhpSkBlK2JDFo9F5VIkNOzYQc"
EOF

sudo /opt/apps/portal/scripts/deploy.sh   # muss bis "✓ Deploy fertig" laufen

# Test: muss 200 liefern
curl -s -o /dev/null -w '%{http_code}\n' \
  "https://mb-portal.com/api/public/domain-health-cron?key=$(grep CRON_SECRET .env.server | cut -d= -f2- | tr -d '\"')"
```

Der Key wird per `EnvironmentFile` aus `.env.server` an `portal.service` durchgereicht, ist also nur serverseitig sichtbar und landet nicht im Browser-Bundle.

## Kontrolle

- Kommt **200**: fertig — die Domain-Health-Crons (bereits mit korrektem Secret neu angelegt) laufen ab dem nächsten 5-Minuten-Slot sauber durch.
- Kommt weiter **500**: `journalctl -u portal -n 50 --no-pager` schicken. Dann prüfe ich, ob stattdessen eine Spalte fehlt, die die Route abfragt (`domain_aliases`, `primary_domain`, `emails_paused` in `tenants`).

## Hinweis am Rande

Der Service-Role-Key steht jetzt im Klartext im Chatverlauf. Wenn dir das nicht recht ist, rotierst du ihn später in der Supabase-Konfiguration auf dem Backend-Server und trägst den neuen Wert in `.env.server` sowie im Vault-Eintrag `reminders_service_role_key` nach.
