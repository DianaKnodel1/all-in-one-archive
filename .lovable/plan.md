## Ziel

Jede automatische Bewerber-Mail einmal nachweisbar auslösen und belegen, dass sie wirklich rausgeht — nicht nur "Cron läuft".

## Was schon existiert (geprüft)

- `scripts/email-test/run-full-chain.sh` + SQL-Snippets `chain-01` … `chain-14`: setzt einen Test-Bewerber gezielt in jeden Zustand und ruft die Cron-Funktionen auf, vorher immer mit `dry_run:true` als Sicherheitsnetz.
- `scripts/email-test/dry-run-all.sh`: zeigt für alle 4 Cron-Endpunkte, wer aktuell fällig wäre — ohne Versand.
- `send-application-reminders` deckt ab: `no_booking_24h`, `no_booking_72h`, `no_show_24h`, `rebook_after_cancel_24h/72h`, `registration_pending_24h/72h`, `interview_invite_30min`, `booking_confirmation`.
- Der KI-Interview-Pfad (`src/routes/api/public/interview-chat.ts`) schreibt bei Zusage `ai_decision` und ruft direkt `send-invitation-email` mit frischem `invitation_tokens`-Eintrag auf.

## Lücke

Für die **KI-Zusage nach absolviertem Interview** gibt es kein Chain-Snippet (Nummern 10–12 fehlen). Genau dieser Schritt — Termin wahrgenommen → Interview → Zusage-Mail — ist damit bisher nie automatisiert getestet worden.

## Vorgehen

1. **Bestandsaufnahme ohne Versand**
   - `dry-run-all.sh` gegen das Backend: zeigt, welche echten Bewerber gerade in welchem Zustand hängen.
   - DB-Auswertung: pro `reminder_kind` die letzten Sends aus `application_reminder_log` + `email_send_log` (Status, Fehler, Empfänger) — welche Kinds sind produktiv je schon einmal erfolgreich rausgegangen, welche nie.

2. **Fehlendes Test-Snippet ergänzen**
   - Neues `chain-10-interview-completed-zusage.sql`: Bewerber auf „Termin wahrgenommen“ (`booking_status = completed`, Termin in der Vergangenheit, `interview_status` gesetzt) und Aufruf des Interview-Endpunkts bis zur Entscheidung, damit die Zusage-Mail über `send-invitation-email` real ausgelöst wird.
   - Einbindung als Stufe in `run-full-chain.sh` (überspringbar via `SKIP`).

3. **Kontrollierter Live-Durchlauf**
   - `run-full-chain.sh` mit einer Test-Adresse (`test+kette@…` oder eine der freigegebenen Adressen), Tenant mit funktionierendem SMTP.
   - Jede Stufe: Zustand setzen → Dry-Run-Check (nur der Testbewerber ist fällig) → echter Send → Log-Zeile prüfen.

4. **Abschlussbericht**
   - Tabelle: Mail-Typ · Auslöser · Zeitpunkt · zuständiger Cron · Testergebnis (angekommen / geskippt / Fehler).
   - Offene Punkte separat, z. B. Mandanten ohne SMTP (MuS Marketing, W3 Personal) und pausierte Mandanten, die im Test zwangsläufig skippen.

## Was ich von dir brauche

- Eine **Test-Empfängeradresse**, in die du reinschauen kannst.
- Den **Mandanten**, mit dem getestet werden soll (muss aktiv sein, SMTP hinterlegt, nicht pausiert).
- Freigabe, dass echte Mails an genau diese Adresse rausgehen dürfen — Schritt 1 und 2 laufen vorher komplett ohne Versand.

## Technische Details

Die Snippets manipulieren ausschließlich Zeilen mit der Test-E-Mail und leeren gezielt `application_reminder_log` je `reminder_kind`, damit die Idempotenz-Sperre (`UNIQUE(application_id, reminder_kind)`) den Wiederholungslauf nicht blockiert. `chain-99-cleanup.sql` räumt am Ende Bewerber, Termine und Logs wieder ab. Kein Eingriff in Produktionsdaten anderer Bewerber; das Skript bricht ab, sobald der Dry-Run mehr als den Testbewerber als fällig meldet.
