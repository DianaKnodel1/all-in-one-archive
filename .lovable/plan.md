## Stand nach deinem Log

Backend ist sauber durch:
- Edge Functions neu deployed (Dedupe-Guards aktiv), keine offenen Migrations.
- Bereinigung: 207 Gruppen, 538 überzählige Zeilen als `duplicate` markiert, Sicherung liegt in `public.email_send_log_dedupe_backup`.
- Der Hauptverursacher ist klar sichtbar: `vermittlung_rebook_after_cancel_24h` (bis zu 48× pro Empfänger pro Tag) — genau der Pfad, für den jetzt zwei Sperren greifen (einmal pro Bewerber+Art über `application_reminder_log`, plus 20-Stunden-Sperre pro Empfänger+Vorlage).

Fehlt noch: der Portal-Server (Frontend). Die neue Anzeige im Mail Center — bereinigte Zeilen ausblenden, „⧉ n bereinigt" in der Verlaufszeile, korrekte Statistik — läuft erst nach diesem Schritt. Bis dahin zeigt das Mail Center die 538 markierten Zeilen noch als ungewohnten Status an.

## Schritt 1 — Portal-Server ausrollen

```bash
cd /opt/apps/portal && git reset --hard HEAD && git pull && bash scripts/deploy.sh
```

Danach im Mail Center prüfen:
- Zählerzeile oben zeigt keine aufgeblähten „offen"-Zahlen mehr.
- Bei einem betroffenen Bewerber (z. B. `s.julke@gmx.de`) steht im Verlauf ein grüner Haken plus „⧉ n bereinigt" statt vieler Einzelzeilen.

## Schritt 2 — Wirksamkeit der Sperre belegen

Die Sperren sind Code, kein Datenstand — beweisen lässt sich das erst nach ein paar Cron-Läufen. Etwa 60–90 Minuten nach dem Deploy auf dem Backend-Server:

```bash
cd /opt/apps/portal-migrations && bash scripts/cleanup-duplicate-mails.sh --local
```

Erwartung: für heute keine neuen Gruppen mit `rebook_after_cancel_*`. Tauchen doch neue auf, liegt es nicht mehr am Zeilenlimit, sondern daran, dass die Log-Zeile beim Versand gar nicht erst geschrieben wird — dann sehe ich mir den Schreibpfad in `send-application-reminders` an.

## Schritt 3 — Aufräumen nach der Bestätigung

Wenn Schritt 2 sauber ist:
- Sicherungstabelle `email_send_log_dedupe_backup` kann bleiben (klein, unschädlich) oder nach ein bis zwei Wochen gelöscht werden.
- Offene Baustelle unabhängig davon: LH Marketing hat weiterhin SMTP-Fehler 535 (Authentifizierung). Dieser Tenant sendet nicht, egal wie sauber die Dedupe-Logik ist — dort müssen die Zugangsdaten neu gesetzt werden.

## Technische Details

- Erste Sperre: `application_reminder_log` wird pro Bewerber und Erinnerungsart mit `count: exact, head: true` abgefragt — serverseitige Zählung, damit das 1.000-Zeilen-Limit von PostgREST nicht mehr greift.
- Zweite Sperre: `email_send_log` wird auf Empfänger + Vorlagenname + Status `sent` der letzten 20 Stunden geprüft.
- Beide Abfragen filtern auf `status = 'sent'`; die neu markierten `duplicate`-Zeilen verfälschen die Prüfung also nicht.
- Bereinigung gruppiert nach `appointment_id` bzw. `application_id`, damit legitime Neubuchungen am selben Tag nicht fälschlich markiert werden.
