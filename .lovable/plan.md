## Ausgangslage (geprüft)

- Deploy auf dem Portal-Server ist erfolgreich (`portal.service` aktiv, Release `20260727-085931`).
- Platzhalter werden **zur Sendezeit** ersetzt: der gemeinsame Mail-Wrapper rendert Betreff und Text mit den übergebenen Variablen (`first_name`, `email`, `portal_link`, `login_link`, `tenant_name`, `missing_documents`, …). Standardvorlagen im Code sind damit automatisch aktuell.
- Nicht überprüfbar von hier aus: individuell überschriebene Vorlagen je Mandant — die liegen in deiner selbst gehosteten Datenbank.

## Schritt 1 — Vorlagen-Check ausführen (du)

Wichtig: **auf dem Backend-Server** (dort läuft der `supabase-db`-Container), nicht auf dem Portal-Server.

```bash
cd /opt/apps/portal-migrations && git pull && bash scripts/check-mail-templates.sh --local
```

Falls dieses Verzeichnis dort nicht existiert, nimm den Ordner, aus dem du `deploy-backend.sh` startest. Alternativ vom Portal-Server aus mit direkter DB-URL:

```bash
cd /opt/apps/portal && TARGET_DB_URL='postgres://…' bash scripts/check-mail-templates.sh
```

Das Skript ist rein lesend und verschickt nichts.

## Schritt 2 — Auswertung (ich)

Du schickst mir die Ausgabe. Ich prüfe:
- welche Mandanten Standardvorlagen nutzen (alles gut) und welche eigene Texte haben,
- veraltete eigene „Registrierung abschließen“-Texte ohne `{{missing_documents}}`,
- eigene Texte ganz ohne Link/Platzhalter (Bewerber kommt nicht weiter),
- unbekannte Platzhalter, die als Rohtext `{{…}}` in der Mail landen würden.

## Schritt 3 — Nachziehen

Für jede auffällige Vorlage: entweder auf die aktuelle Standardvorlage zurücksetzen (Feld auf NULL) oder den eigenen Text um die fehlenden Platzhalter ergänzen. Das mache ich als eine SQL-Migration in `supabase/manual-migrations/`, die du mit `bash scripts/deploy-backend.sh` einspielst.

## Schritt 4 — Gegenprobe

Nach dem Nachziehen erneut `check-mail-templates.sh` (keine Zeile mit `!`) und danach `bash scripts/verify-mail-matrix.sh --local` für die Versandhistorie.
