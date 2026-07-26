## Problem

Der Deploy baut das Frontend gegen die falsche Backend-URL.

```text
Ist:   https://iiabvudipyliimxjdpue.supabase.co  (Lovable-Cloud-DB, leer)
Soll:  https://api.mb-portal.com                 (dein self-hosted Supabase)
```

Die Datei `.env` ist nicht in `.gitignore` eingetragen, liegt also im GitHub-Repo. Beim `git reset --hard origin/main` wurde die Server-`.env` durch die Lovable-Werte ersetzt. `scripts/deploy.sh` liest genau diese Datei und exportiert die Werte in den Vite-Build — deshalb die falsche Anzeige in Schritt 0/5.

## Änderungen im Repo

1. **`.gitignore`**: `.env` (und `.env.*.local`) ergänzen, damit Umgebungs-Werte nie wieder per Push/Pull die Server-Konfiguration überschreiben. Die lokale `.env` für die Lovable-Vorschau bleibt bestehen, wandert nur aus der Versionskontrolle.
2. **`.env` aus dem Repo entfernen** (Datei bleibt lokal und auf dem Server erhalten, nur nicht mehr getrackt).
3. **`.env.example` aktualisieren**: klar dokumentierte Vorlage mit `api.mb-portal.com` als Beispiel-Backend, damit auf einem frischen Server sofort klar ist, was einzutragen ist.
4. **Schutz in `scripts/deploy.sh`**: Bricht der Deploy ab bzw. warnt deutlich, wenn `VITE_SUPABASE_URL` auf `*.supabase.co` zeigt, während erkennbar self-hosted deployt wird. Damit kann ein versehentlich falscher Wert nicht mehr unbemerkt live gehen.

## Auf deinem Server (einmalig, nach dem Repo-Update)

Da die `.env` dort bereits überschrieben wurde, muss sie einmal von Hand korrigiert werden:

```bash
cd /opt/apps/portal
cat > .env <<'EOF'
VITE_SUPABASE_URL="https://api.mb-portal.com"
VITE_SUPABASE_PUBLISHABLE_KEY="<dein anon/publishable key des self-hosted Supabase>"
SUPABASE_URL="https://api.mb-portal.com"
SUPABASE_PUBLISHABLE_KEY="<derselbe key>"
EOF
git pull
sudo /opt/apps/portal/scripts/deploy.sh
```

Der Key ist der alte `eyJhbGci…TYeA` aus deinem bisherigen Deploy (steht in `/opt/supabase/docker/.env` als `ANON_KEY`). Nach dem Deploy muss Schritt 0/5 wieder `https://api.mb-portal.com` anzeigen.

## Technische Hinweise

- Vite-Variablen (`VITE_*`) werden beim Build fest in die JS-Bundles eingebrannt — ein falscher Wert lässt sich nur durch einen erneuten Build korrigieren, nicht zur Laufzeit.
- Die Lovable-Vorschau in diesem Projekt nutzt weiterhin die Cloud-DB; das ist getrennt vom Server-Deploy und beeinflusst ihn nach der Änderung nicht mehr.
- Empfehlung: den Cloud-Publishable-Key, der jetzt öffentlich im GitHub-Repo liegt, anschließend rotieren.
