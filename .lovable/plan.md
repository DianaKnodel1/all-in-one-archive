## Was ich geprüft habe

Die E-Mail-Historie im Bewerbungs-Dialog wird aus **zwei Quellen** zusammengeschüttet (`src/routes/admin.bewerbungen.tsx`):

- `email_send_log` — jeder tatsächliche SMTP-Versand (Vorlagenname, z. B. `vermittlung_booking_confirmation`)
- `application_reminder_log` — der Reminder-Motor protokolliert zusätzlich, dass er den Schritt ausgelöst hat (`reminder_kind`, z. B. `booking_confirmation`)

Beide Listen werden ungefiltert aneinandergehängt. Deshalb erscheint **eine** Mail zweimal: einmal als „Vermittlung · Terminbestätigung“ (Versand-Log) und einmal als „Erinnerung · Kein Termin (24 h)“ / „Terminbestätigung“ (Reminder-Log). Es wurde also wirklich nur einmal gesendet — die Anzeige zählt doppelt.

Antwort auf deine zweite Frage: Fehlversand **wird** protokolliert (`status` = `failed`/`dlq`/`bounced`/`suppressed`/`skipped` mit Fehlertext) und in der Historie rot bzw. gelb angezeigt. Was fehlt: ein Resend **pro einzelner Mail** — aktuell gibt es im Dialog nur „Einladung erneut senden“. Ein generischer Resend existiert bereits (`email-resend`, sendet das gespeicherte HTML erneut), er ist nur im Mail Center verdrahtet, nicht in der Bewerber-Historie.

## Plan

**1. Duplikate zusammenführen (Ursache der Doppelanzeige)**
- Reminder-Log-Einträge und Versand-Log-Einträge werden gepaart, wenn sie denselben logischen Schritt betreffen und zeitlich nah beieinander liegen (Zeitfenster ± 10 Min).
- Der Versand-Log-Eintrag gewinnt (er kennt Status, Fehlertext und Log-ID für den Resend); der Reminder-Eintrag wird verworfen.
- Reminder-Einträge **ohne** passenden Versand bleiben sichtbar — genau die sind der wertvolle Hinweis „ausgelöst, aber nie versendet“ und bekommen den Status „hängen geblieben“.

**2. Fehler-/Hänger-Sicht im Dialog**
- Kopfzeile im Historie-Dialog: „X gesendet · Y fehlgeschlagen · Z hängen geblieben“.
- Jeder nicht-gesendete Eintrag zeigt den Klartext-Grund (SMTP-Fehler, Tenant pausiert, keine SMTP-Daten, Empfänger gesperrt).

**3. Einzel-Resend je Mail**
- Neben jedem Eintrag mit Versand-Log-ID ein „Erneut senden“-Button, der den bestehenden `email-resend`-Weg nutzt.
- Nach Erfolg wird die Historie neu geladen; der Eintrag wechselt auf „gesendet“ und fällt damit aus der Ausstehend/Fehler-Zählung im Mail Center.
- Bei Einträgen ohne Versand-Log (reiner Reminder-Hänger) bleibt der bisherige Weg „Einladung erneut senden“ bzw. ein Hinweis, dass der Cron den Schritt beim nächsten Lauf nachholt.

## Technische Details

- `src/lib/mail-chain.ts`: neue Funktion `mergeMailEvents(events)` — Normalisierung der Schlüssel (`vermittlung_`/`fasttrack_`-Präfixe entfernen) und Dedup über `normalisierterKey + Zeitfenster`; `MailEvent` bekommt optional `logId`.
- `src/routes/admin.bewerbungen.tsx`: `email_send_log`-Query zusätzlich `id` selektieren, `mergeMailEvents` vor Übergabe an `MailChain` anwenden. Gleiches in `src/routes/admin.personen.$id.tsx`, falls dort dieselbe Kette gerendert wird.
- `src/components/mail/MailChain.tsx`: Zusammenfassungszeile, Grund-Anzeige und Zeilen-Resend über `resendEmailLog` aus `src/lib/email-resend.ts`.
- Reine Frontend-/Anzeige-Änderung: keine Migration, kein Versandverhalten geändert, keine Edge Function angefasst.
