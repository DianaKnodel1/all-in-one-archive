## Zwei Themen

### A) LH Marketing SMTP (erledigt, keine Codeänderung)
Die Prüfung zeigt: Host/Port/Benutzer sind korrekt gespeichert, das Passwort hat 15 Zeichen. Der Mailanbieter antwortet auf beiden Ports mit `535 authentication failed` — das kommt vom Anbieter, nicht aus dem Portal. Also: bei privateemail.com ein neues (App-)Passwort erzeugen, im Portal eintragen, Test-Mail senden. Danach wird der Tenant automatisch entpausiert. Kein Teil dieses Plans.

### B) „Termin um 22 Uhr startet nicht"
Aktueller Stand im Code: Die Terminseite (`/termin/<cancel_token>`, Screenshot 1) zeigt nur Datum/Uhrzeit, „Neuen Termin wählen" und „Absagen" — **es gibt dort keinen Einstieg ins Gespräch**. Der einzige Weg ins Interview ist die Mail „In 30 Minuten startet Ihr Bewerbungsgespräch", die vom Cron ~25–40 Min vor Terminbeginn verschickt wird und auf `https://<landing-domain>/bewerbung?token=…` zeigt. Fällt diese Mail aus (kein Magic-Token, keine Landing-Domain, SMTP pausiert) oder wird sie übersehen, kommt der Bewerber nicht ins Gespräch.

**Geplant:**
1. Terminseite um einen Gesprächsbereich erweitern:
   - vor dem Termin: Countdown „Ihr Gespräch startet in HH:MM" (Button inaktiv),
   - ab 5 Minuten vor Beginn (gleiche Schwelle wie das Server-Gate): aktiver Button **„Gespräch jetzt starten"**, der direkt auf die Interview-Seite der Bewerbung führt,
   - nach abgeschlossenem Gespräch: Hinweis statt Button.
2. Die dafür nötigen Felder (Bewerbungs-ID, Landing-Slug, Portal-Basis, Interview-Status) in der bestehenden Server-Funktion für den Termin-Link mitliefern.
3. Denselben Startbereich auf dem Bestätigungsschritt nach der Buchung anzeigen, damit der Link sofort bekannt ist.
4. Prüfschritt für deinen Server: kontrollieren, ob für die betroffene Bewerbung `magic_token` und Landing-Domain gesetzt sind — sonst kann die 30-Minuten-Mail gar nicht rausgehen.

### C) „Willkommen im Team"-Mail ohne Interview
Die Mail wird an genau drei Stellen ausgelöst: nach positiver KI-Entscheidung am Gesprächsende (Chat und Voice) und beim Admin-Stufenwechsel auf „Vermittlung: Zusage" / „Fast-Track angenommen". Welcher dieser Wege bei dem Test gefeuert hat, lässt sich nur an deiner Datenbank belegen — das ist Schritt 1.

**Geplant:**
1. Nachweis holen (Abfrage auf deinem Backend-Server): Interview-Status, Nachrichtenanzahl, Empfehlung, Stufenverlauf und Zeitpunkt der versendeten Einladung für die betroffene Bewerbung. Erst danach steht die Ursache fest.
2. Unabhängig davon eine harte Schutzregel einziehen: Die Registrierungs-Einladung darf nur rausgehen, wenn das Gespräch wirklich stattgefunden hat — also Interview abgeschlossen **und** ein Verlauf mit echten Antworten vorhanden. Fehlt das, wird nicht gesendet, sondern der Grund protokolliert.
3. Für Admins bleibt der Weg offen, aber bewusst: Bei manueller Zusage ohne stattgefundenes Gespräch erscheint ein Hinweis, dass noch kein Interview vorliegt, und die Mail geht nur nach ausdrücklicher Bestätigung raus.
4. Zusätzlich einmalig im System nachsehen, ob es weitere Bewerbungen mit Einladung, aber ohne Gesprächsverlauf gibt.

## Technische Details
- Betroffene Dateien: `src/routes/termin.$token.tsx`, `src/routes/termin.buchen.$token.tsx`, `src/lib/appointments.functions.ts` (Rückgabe um `application_id`, `interview_status`, `landing_slug` erweitern), `src/lib/interview-engine.server.ts` (Guard in `sendRegistrationInviteAfterAiAccept`), `src/lib/application-stage.functions.ts` (Guard + `force`-Parameter), Admin-UI der Bewerbungen für den Bestätigungsdialog.
- Die 5-Minuten-Vorlaufschwelle im Frontend entspricht exakt dem bestehenden Server-Gate in `src/routes/api/public/interview-chat.ts`, damit Button und Server nie widersprüchlich reagieren.
- Keine Migration nötig; Zeitzone bleibt Europe/Berlin wie zuletzt gefixt.
