## Ziel

Auslesen, warum UWK Consulting pausiert ist — und dann bewusst entscheiden statt blind freigeben.

## Warum ein Skript nötig ist

Deine Mandantendaten liegen auf dem selbst gehosteten Backend. Von hier aus habe ich keinen Lesezugriff darauf, also braucht es einen kurzen Befehl, den du auf dem Portal-Server ausführst.

## Was gebaut wird

Ein Skript `scripts/tenant-pause-status.sh` im Stil der vorhandenen (`check-mail-health.sh`, `fix-mail-crons.sh`):

**Standardlauf — nur anzeigen, ändert nichts:**
- alle pausierten Mandanten mit Name, Grund, Auslöser (`manuell` / `auto:domain_down`) und Zeitpunkt
- dazu die passenden Einträge aus dem `activity_log` (`emails_auto_pausiert`), damit du siehst, welcher Cron-Lauf es war
- der SMTP-Health-Stand pro Mandant: Fehlversuche in Folge, letzter Fehler, letzte Prüfung
- bei `auto:domain_down` zusätzlich ein Live-Erreichbarkeitstest der betroffenen Domains — so siehst du sofort, ob das Problem noch besteht oder längst behoben ist

**Mit `--release "UWK"`:**
- hebt die Pause für genau diesen Mandanten auf, setzt den Fehlerzähler zurück und schreibt einen Eintrag ins Aktivitätsprotokoll
- vorher Rückfrage mit Anzeige des aktuellen Grundes

## Ablauf für dich

Auf dem Portal-Server:

```
cd /opt/apps/portal && git pull
bash scripts/tenant-pause-status.sh
```

Ausgabe schickst du mir, dann klären wir gemeinsam, ob Freigabe sinnvoll ist oder erst die Ursache weg muss.

## Nebenbefund zur Entscheidung

Die automatische Pause bei SMTP-Fehlern ist im Code deaktiviert (`if (false && fails >= 5)`). Falls du willst, dass ein dauerhaft kaputter Mailserver den Versand wirklich stoppt, wäre das ein separater kleiner Eingriff — sag Bescheid, ich fasse es in diesem Schritt bewusst nicht an.

## Technische Details

- SQL über `psql` als `supabase_admin`, per stdin gepiped (keine `$$`-Expansion im Shell-Kontext)
- gelesen wird `tenants` (`emails_paused*`), `tenant_smtp_health`, `activity_log`
- Domain-Check per `curl -sS -o /dev/null -w '%{http_code}'` mit Timeout, analog zur Logik in `src/routes/api/public/domain-health-cron.ts`
- keine Schemaänderung
