# E-Mail-Kette und Anti-Spam absichern

## Zielbild

Jede Mail erhält einen eindeutigen Auslöser und eine feste maximale Anzahl:

| E-Mail | Auslöser | Maximum |
|---|---|---:|
| Bewerbung eingegangen | Formular erfolgreich gespeichert | 1 je Bewerbung |
| Terminbestätigung | Termin erfolgreich gebucht | 1 je konkretem Termin; nach Absage und echter Neubuchung erneut 1 |
| Interview-Einladung | 30 Minuten vor dem aktuellen Termin | 1 je Termin |
| Noch keinen Termin gebucht | 24 h und 72 h nach Bewerbung | je 1 |
| Termin nicht wahrgenommen | 24 h nach verstrichenem Termin | 1 |
| Neuer Termin nach Absage | 24 h und 72 h nach Absage, sofern nicht neu gebucht | je 1; vorhandener Text „Wir würden Sie trotzdem sehr gerne kennenlernen …“ bleibt erhalten |
| Zusage / Willkommen | Erst nach positiv abgeschlossenem Interview bzw. bewusster Recruiter-Zusage | 1 je Zusage |
| Einladung noch nicht genutzt | 24 h und 72 h nach Einladung | je 1 |
| Onboarding unvollständig | Registrierung vorhanden, Ausweis/Vertrag fehlen; 24 h und 72 h | je 1 |
| E-Mail bestätigen | Direkt bei Registrierung | 1 initiale Mail |
| E-Mail unbestätigt | 24 h nach Registrierung | genau 1 automatische Erinnerung |
| Bestätigung erneut senden | Nur durch aktiven Nutzerklick | mit kurzer Klick-/Parallelitätssperre |
| Passwort zurücksetzen | Nur durch aktiven Nutzerwunsch | mit kurzer Klick-/Parallelitätssperre |

## Umsetzung

1. **Automatische Erinnerungstaktung korrigieren**
   - Die derzeit allgemeine 3-Stufen-Logik mit 24/48/72 Stunden auf getrennte Regeln umstellen.
   - E-Mail-Bestätigung auf genau eine automatische 24-h-Erinnerung begrenzen.
   - Einladung offen und Onboarding unvollständig separat auf 24 h und 72 h begrenzen.
   - Legacy-Auto-Einladungen und alte Queue-Pfade deaktiviert lassen.

2. **Eindeutige Versandidentität je Ereignis**
   - Für jede automatische Mail einen stabilen Schlüssel aus Bewerbung, Mailtyp und Ereignis verwenden.
   - Terminmails zusätzlich an die konkrete Termin-ID binden, damit eine echte Neubuchung eine neue Bestätigung erlaubt, derselbe Termin aber nie doppelt versendet wird.
   - Zusage-, Bewerbungs- und Registrierungs-Mails an Bewerbung beziehungsweise Einladung binden.

3. **Atomare Sperre vor dem SMTP-Versand**
   - Vor jedem automatischen Versand eine eindeutige Reservierung anlegen.
   - Parallele Cron-Läufe dürfen dieselbe Reservierung nicht gleichzeitig erhalten.
   - Bei Erfolg dauerhaft als versendet markieren; bei technischem Fehler kontrolliert für einen späteren Retry freigeben, ohne zwei parallele Sends zu ermöglichen.
   - Bestehende Datenbank-Sperren idempotent ergänzen und über beide Selfhosting-Deploy-Skripte sicher ausrollen.

4. **Manuelle und nutzergetriebene Mails schützen**
   - „Bestätigung erneut senden“ und „Passwort zurücksetzen“ gegen Doppelklicks und parallele Requests absichern.
   - Bewusste Admin-Resends weiterhin ermöglichen, aber als manuellen Neuversand mit eigener Nonce protokollieren.
   - SMTP-Testmails und Vorschauen strikt von produktiven Automatik-Mails getrennt halten.

5. **Abbruchbedingungen vollständig prüfen**
   - Sobald ein Termin gebucht wurde, keine No-Booking-Mail mehr.
   - Sobald nach einer Absage neu gebucht wurde, keine Rebook-Mail mehr.
   - Sobald registriert wurde, keine Einladung-offen-Mail mehr.
   - Sobald die E-Mail bestätigt wurde, keine Bestätigungs-Erinnerung mehr.
   - Sobald Onboarding vollständig ist, keine Abschluss-Erinnerung mehr.
   - Bounce-, Complaint-, Pause- und Empfängersperren bleiben vorgeschaltet.

6. **Mail-Center nachvollziehbar machen**
   - Jede tatsächliche, blockierte und fehlgeschlagene Mail weiterhin protokollieren.
   - Technische Doppelversand-Sperren als „Duplikat verhindert“ statt als gesendete Mail darstellen.
   - Bei Terminmails die Termin-ID und bei manuellen Resends den manuellen Ursprung sichtbar hinterlegen.

7. **End-to-End-Testmatrix ausführen**
   - Die vorhandene Testkette für Bewerbung, Buchung, 30-Minuten-Einladung, 24/72-h-Reminder, No-Show, Absage/Neubuchung, Zusage, Registrierung und Onboarding erweitern.
   - Jede Stufe zweimal und zusätzlich parallel auslösen: Beim zweiten beziehungsweise parallelen Lauf darf kein weiterer SMTP-Send entstehen.
   - Danach Cron-Konfiguration, Datenbank-Sperren und Mail-Center-Einträge prüfen und einen klaren Deploy-/Prüfbefehl für Frontend und Backend liefern.

## Bereits bestätigte Abweichung

Die allgemeine Reminder-Funktion erlaubt aktuell bis zu drei Sends mit einer 24/48/72-h-Logik. Das passt nicht zu den festgelegten Regeln und wird in getrennte, ausdrücklich begrenzte Abläufe aufgeteilt. Die gewünschte Absage-Logik mit 24 h und 72 h existiert bereits einschließlich des Textes „Wir würden Sie trotzdem sehr gerne kennenlernen …“ und wird beibehalten sowie technisch gegen Doppelversand abgesichert.