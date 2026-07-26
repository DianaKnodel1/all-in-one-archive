## Ziel

Prüfen, ob auf dem selbstgehosteten Backend (`api.mb-portal.com`) das Mail-System und alle Cron-Jobs/Reminder tatsächlich laufen.

Wichtig: Von hier aus habe ich keinen Zugriff auf deine Backend-Datenbank — die Prüfung läuft über Befehle, die du auf dem Backend-Server ausführst, plus einen Kontroll-Blick im Admin-UI.

## Ablauf

### 1. Cron-Jobs existieren und feuern
Auf dem Backend-Server im Postgres-Container prüfen:
- Welche Jobs registriert und aktiv sind (`cron.job`) — erwartet: `send-application-reminders`, `send-appointment-reminders`, `process-invite-resend-queue`, `auto_complete_appointments`, `send-reminders-hourly`, `domain-health-cron`.
- Ob jeder Name genau **einmal** vorkommt (Duplikate waren früher die Fehlerursache).
- Letzte Läufe und Fehlermeldungen (`cron.job_run_details`).

Häufigster Fehlerfall: der Vault-Eintrag `reminders_service_role_key` fehlt oder die URL im Job-Command steht noch als Platzhalter — dann laufen die Jobs, aber jeder HTTP-Call schlägt fehl.

### 2. Edge Functions erreichbar
Jede Mail-Function einmal direkt anstoßen und HTTP-Status + Logs prüfen: `send-application-reminders`, `send-appointment-reminders`, `send-reminders`, `process-invite-resend-queue`, `send-chat-reminder`.

### 3. SMTP je Mandant
- `tenants`: sind `smtp_host/port/user/pass` gefüllt, ist `emails_paused = false`, was steht in `smtp_health_status`?
- `smtp-test`-Function gegen eine echte Adresse laufen lassen.

Hinweis aus dem Import: die Datenbank wurde nur mit Struktur, ohne Daten übernommen — falls die SMTP-Felder leer sind, geht aktuell garantiert keine Mail raus, unabhängig von den Crons.

### 4. Versand-Historie auswerten
- `email_send_log` der letzten 24 h nach Status gruppiert.
- Einträge mit `failed`/`bounced`/`dlq`.
- `suppressed_emails` (geblockte Empfänger).
- `application_reminder_log` / `appointment_reminder_log`: feuern die Reminder-Ketten überhaupt?

### 5. End-to-End-Test
Eine Test-Bewerbung anlegen und die Kette durchspielen (Eingangsbestätigung → Buchungsbestätigung → 30-Min-Interview-Reminder). Dafür existieren bereits Snippets unter `scripts/email-test/sql-snippets/`, mit denen sich Zeitstempel künstlich vordatieren lassen, sodass die Cron-Gates sofort greifen.

### 6. Kontrolle im Admin-UI
`/admin/email-logs` und das `CronHealthPanel` gegenprüfen — dort muss jeder Job „Healthy" zeigen; „Stillstand" heißt, der Job läuft nicht oder die Function scheitert.

## Was ich liefere

Ein Prüf-Skript `scripts/check-mail-health.sh`, das die Schritte 1–4 in einem Durchlauf gegen die Backend-DB ausführt und ein kompaktes Ergebnis ausgibt (Cron-Status, letzte Laufzeiten, SMTP-Zustand pro Mandant, Mail-Statistik, Fehlerliste) — damit du das jederzeit mit einem Befehl wiederholen kannst, statt einzelne SQL-Abfragen zu kopieren. Zusätzlich eine kurze Auswertung deiner Ausgabe und, falls nötig, Korrektur-Migrationen (z. B. Cron-Neuregistrierung oder fehlender Vault-Eintrag).

## Technische Details

- Skript nutzt `psql` über `docker exec supabase-db` bzw. `TARGET_DB_URL`, rein lesend (nur `SELECT`).
- Keine Änderungen an Edge Functions oder Schema in diesem Schritt — erst Diagnose, dann gezielte Fixes.
