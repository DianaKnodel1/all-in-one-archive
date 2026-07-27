## Was der Screenshot zeigt

Die Meldung ist diesmal eine **andere** als vorher: „Failed to send a request to the Edge Function". Das ist kein Fehler *aus* der Funktion, sondern heißt: die Funktion hat **gar nicht geantwortet** — sie wurde nach Ablauf der Laufzeit abgebrochen.

Dazu passt der Befund im Code: der Mail-Versand in `send-invitation-email` baut die SMTP-Verbindung **ohne jedes Timeout** auf (`nodemailer.createTransport` ohne `connectionTimeout`/`greetingTimeout`/`socketTimeout`, `sendMail` ohne Zeitlimit). Nur der Verify-Schritt hat 15 s. Wenn der Mailserver von LH Marketing die Verbindung annimmt, aber nicht sauber antwortet (typisch bei falschem Port/SSL-Modus oder geblocktem Port 465/587 vom Backend-Server aus), hängt die Funktion, bis die Plattform sie killt — und im Portal kommt genau diese generische Meldung an. Bei den anderen Mandanten antwortet SMTP sofort, deshalb funktioniert es dort.

Hinweis: dass Versand über das Webmail-Postfach klappt, sagt nichts über SMTP-Zugang von außen — Webmail geht nicht über SMTP-Auth.

## Umsetzung

**1. Harte Timeouts im Mail-Versand** (`supabase/functions/send-invitation-email/index.ts`)
- `connectionTimeout: 10000`, `greetingTimeout: 10000`, `socketTimeout: 20000` am Transport.
- `sendMail` zusätzlich gegen ein 25-s-Limit rennen lassen, damit die Funktion **immer** antwortet.
- Bei Timeout: Log-Eintrag `failed` mit klarem Grund (`smtp_connect_timeout` / `smtp_send_timeout` inkl. Host/Port) und HTTP 502 mit dieser Klartextmeldung.

Dieselben Timeouts in den übrigen Versand-Funktionen ergänzen, die noch ohne laufen (`resend-signup-confirmation`, `send-booking-confirmation`, `send-reminders`, `email-resend`, …) — sonst hängt dort dasselbe.

**2. Fehleranzeige im Portal** (`src/routes/admin.tenants.tsx`)
- Netzwerk-/Timeout-Fehler beim Aufruf (kein JSON-Body) nicht mehr als „konnte nicht versendet werden" abtun, sondern als eigenen Hinweis zeigen: „Der Mailserver hat nicht rechtzeitig geantwortet — Host/Port/SSL prüfen (465 = SSL, 587 = STARTTLS)."

**3. Diagnose-Skript** `scripts/smtp-probe.sh`
Prüft vom Backend-Server aus für einen Mandanten, ob Port 465 und 587 überhaupt erreichbar sind und was der Server als Greeting schickt — damit unterscheidbar wird: Port geblockt, falscher SSL-Modus oder falsche Zugangsdaten.

## Danach

Deploy der geänderten Functions auf dem Backend-Server, dann Test-Mail erneut. Statt der generischen Meldung steht dann entweder der konkrete SMTP-Fehler (z. B. „535 Authentication failed") oder „Verbindung zu host:port nach 10 s ohne Antwort" — damit ist klar, ob es an Zugangsdaten oder am Port liegt.
