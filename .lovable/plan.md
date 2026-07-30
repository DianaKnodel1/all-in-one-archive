## 1. Texte im Bewerbungsgespräch (Screenshot)

`src/routes/interview.$appId.tsx` und `src/routes/interview.voice.$appId.tsx`:

- Satz „Ihre Antworten werden zur Bewerbungsauswertung gespeichert und für maximal 6 Monate aufbewahrt. Es findet keine Audio-Aufnahme statt." wird entfernt.
- „Das Gespräch wird digital geführt und automatisiert ausgewertet." → „**Das Gespräch findet digital statt** – Ihre Antworten gehen anschließend direkt an Ihre Ansprechpartnerin bzw. Ihren Ansprechpartner." (Voice-Variante analog: „Das Gespräch findet als Sprachgespräch statt …")
- Rest (Dauer, Themen, Button) bleibt unverändert.

## 2. Terminauswahl: einheitliche Texte + einheitliche Zeitzone

Alle Themes nutzen bereits denselben Renderer `src/landing-themes/_shared/form-section.js` – der Text steht also nur an einer Stelle und gilt automatisch für jedes Theme. Ich prüfe zusätzlich alle Theme-Ordner auf eigene, abweichende Buchungstexte und entferne Duplikate.

Neue, einheitliche Formulierung:
- Überschrift „Wunschtermin wählen"
- „Wählen Sie einen freien Termin für Ihr Gespräch."
- „Sie erhalten sofort eine Bestätigung per E-Mail – mit Kalendereintrag und allen Infos zum Gespräch."
- „Freie Termine in den nächsten 4 Wochen"
- Neue Zeile: „Alle Zeiten in deutscher Zeit (Europe/Berlin)."

Zeitzone vereinheitlichen: Die Slot-Anzeige nutzt derzeit die Zeitzone des Bewerber-Browsers (`Intl` ohne feste Zone). Sitzt jemand im Ausland, sieht er andere Uhrzeiten als in der Mail steht. Künftig werden Tages- und Uhrzeit-Formatter fest auf `Europe/Berlin` gesetzt – damit stimmen Landing Page, Bestätigungsseite und E-Mail immer überein.

Ergänzend serverseitig: `_shared/format-datetime.ts` wird auf die feste Berlin-Berechnung umgestellt (die bisherige „ICU-Erkennung" kann auf dem selbst gehosteten Server in UTC kippen – das erklärt die 22:30 statt 00:30 in der Bestätigungsmail). Zur Kontrolle schreibt die Bestätigungsfunktion UTC-Zeit + gerenderte Ortszeit in die Log-Metadaten.

## 3. „Greeting never received" – Ursache und automatischer Nachversand

Ursache: Das ist kein Bewerbungs- oder Vorlagenfehler, sondern die SMTP-Verbindung. Nodemailer wartet nach dem Verbindungsaufbau auf die Begrüßungszeile (`220`) des Mailservers; kommt sie nicht innerhalb von 10 Sekunden, bricht er ab. Typisch bei überlastetem/gedrosseltem Mailserver, kurzer Netzstörung oder blockiertem Port. Ja – das kann jede Mailart treffen, weil alle denselben SMTP-Weg nutzen.

Umsetzung (neuer gemeinsamer Helfer `supabase/functions/_shared/smtp.ts`, genutzt von allen 13 Versandstellen):

- Timeouts hochsetzen: Verbindung/Begrüßung 20 s, Socket 30 s; bei Port 587 `requireTLS`, `tls.servername` = SMTP-Host.
- **Sofort-Wiederholung innerhalb desselben Versandvorgangs**: bis zu 2 zusätzliche Versuche (nach 5 s und 15 s), aber **nur** bei reinen Verbindungsfehlern (`Greeting never received`, `ETIMEDOUT`, `ECONNECTION`, `ESOCKET`). Bei Auth-Fehlern (535), abgelehnter Empfängeradresse oder Vorlagenfehlern wird **nicht** wiederholt.
- **Kein Spam-Risiko**: Die Wiederholung passiert innerhalb der bereits gesetzten Sperre (Claim + Unique-Index). Ein Versuch gilt erst als „gesendet", wenn der Server ihn angenommen hat; Verbindungsabbrüche vor der Annahme bedeuten, dass keine Mail zugestellt wurde. Es entsteht also kein zweiter Versand derselben Mail.
- Fehlertexte werden übersetzt, bevor sie im E-Mail-Center landen: „SMTP-Server hat nicht geantwortet – Verbindung/Port prüfen" statt „Greeting never received".
- Verbleibende Fehlschläge bleiben wie bisher im E-Mail-Center sichtbar und lassen sich dort manuell erneut senden.

## 4. Bewerbung-eingegangen-Mail: 502 vom Gateway (Screenshot 4 der letzten Runde)

Der rote Block war eine komplette Cloudflare-Fehlerseite: Das Portal rief die Mailfunktion per HTTP auf und bekam einen 502 zurück.

- `src/routes/api/public/applications.ts`: bei 502/503/504 oder Netzwerkfehler bis zu 3 Versuche (0,5 s / 2 s Abstand), bevor „fehlgeschlagen" protokolliert wird. Auch hier keine Doppelmail, weil die Function bei einem 502 gar nicht bis zum Versand kam und die Sperre pro Ereignis greift.
- HTML-Antworten werden erkannt und nicht mehr roh gespeichert → Klartext „Mailfunktion nicht erreichbar (HTTP 502)", Rohtext gekürzt in den Metadaten.
- E-Mail-Center: Fehlertext auf 2 Zeilen begrenzt mit vollem Text im Tooltip; im Vorschau-Iframe wird `<meta charset="utf-8">` ergänzt, damit keine „Ã¤"-Zeichen mehr erscheinen.

## Technische Details

- Neu: `supabase/functions/_shared/smtp.ts` (Transport + gezielter Retry + Fehlerübersetzung); alle `createTransport`-Aufrufe stellen darauf um.
- Geändert: `_shared/format-datetime.ts`, `src/routes/api/public/applications.ts`, `src/routes/admin.email-center.tsx`, `src/landing-themes/_shared/form-section.js` (+ Theme-Assets-Build), `src/routes/interview.$appId.tsx`, `src/routes/interview.voice.$appId.tsx`.
- Keine Datenbankmigration nötig; alle bestehenden Anti-Spam-Sperren bleiben unverändert.
- Danach: Edge Functions neu deployen (`scripts/deploy-backend-local.sh`), Portal `git pull && sudo scripts/deploy.sh`.
