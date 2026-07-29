## Was der Screenshot zeigt

Bei Ty Yoshua Agner steht die Kette auf `Bewerbung ✓ · Termin ✓ · Erinnerung ✓ · Zusage ⏱`, dazu die Zeile „Nächster Schritt: Zusage-Mail steht aus".

Diese Kombination bedeutet exakt: **Die Bewerbung ist auf „Zusage erteilt", aber zu dieser Bewerbung existiert im E-Mail-Protokoll überhaupt kein Eintrag für die Registrierungs-Einladung** — weder „gesendet", noch „fehlgeschlagen", noch „übersprungen". Erst wenn ein Eintrag vorhanden ist, springt die Anzeige auf ✓/⚠/⏭ und der nächste Schritt wird auf die 24h/72h-Registrierungs-Erinnerungen umgestellt.

## Warum kein Eintrag existiert (im Code gefundene Lücke)

Beim Setzen der Zusage über die Admin-Oberfläche prüft das System zuerst, ob für die Bewerbung bereits ein Einladungs-Token existiert. Ist das der Fall, bricht es mit dem internen Grund `already_invited` ab — **ohne Mailversand und ohne jeden Protokolleintrag**. Genau dieser Pfad erzeugt die Anzeige aus dem Screenshot. Alle anderen Abbruchgründe (kein abgeschlossenes Interview, SMTP-Fehler, Token-Fehler) werden dagegen protokolliert.

Zweite, kleinere Lücke: Bei erfolgreichem Versand schreibt nur die Mail-Funktion selbst ins Protokoll (Vorlagenname `invitation`); im Portal-Pfad wird nichts zusätzlich vermerkt. Fällt dieser Log-Schreibvorgang aus (z. B. Mandant pausiert, SMTP-Timeout im Zwischenschritt), bleibt die Kette ebenfalls auf ⏱ stehen, obwohl der Versand angestoßen wurde.

Ob bei diesem konkreten Bewerber Fall 1 oder Fall 2 vorliegt, lässt sich nur auf der Live-Datenbank feststellen — deshalb ist die Prüfung Schritt 1.

## Vorgehen

**1. Verifizieren (Live-Backend, keine Codeänderung)**
`scripts/diagnose-invite-mail.sh` mit der E-Mail des Bewerbers ausführen. Ausgabe zeigt: Empfehlung, Interview-Status, vorhandene Einladungs-Tokens, `invite_mail_status` und alle Protokollzeilen. Damit ist die Ursache belegt.

**2. Lückenlos protokollieren**
In `src/lib/application-stage.functions.ts`: den `already_invited`-Abbruch nicht mehr still lassen, sondern über dieselbe Protokollfunktion wie die anderen Abbrüche schreiben (Status „übersprungen", Grund „Einladung wurde bereits erzeugt, Token vom TT.MM. HH:MM").
In `src/lib/interview-engine.server.ts`: die Protokollfunktion so öffnen, dass sie auch von außen mit einem Grund aufrufbar ist, und beim erfolgreichen Versand zusätzlich einen Erfolgsvermerk an der Bewerbung sicherstellen.

**3. Anzeige präziser machen**
In `src/lib/mail-next-step.ts` den Text „Zusage-Mail steht aus" nach Ursache aufteilen:

- kein Versandversuch protokolliert → „Zusage-Mail wurde nie ausgelöst — jetzt manuell senden"
- Versuch übersprungen (bereits eingeladen) → „Einladung bereits erzeugt — Registrierung offen"
- Versuch fehlgeschlagen → „Zusage-Mail fehlgeschlagen:    
Grundlage dafür sind die an der Bewerbung gespeicherten Felder `invite_mail_status` / `invite_mail_at` / `invite_mail_error`, die in `src/routes/admin.bewerbungen.tsx` zusätzlich an die Berechnung übergeben werden. Ausserdem `bewerbung_magic_link` in die Trefferliste der Zusage-Mails aufnehmen (steht heute nur in der Ketten-Logik, nicht in der Nächster-Schritt-Logik — daher können beide Bausteine auseinanderlaufen).

**4. Handlungsknopf direkt an der Zeile**
Ist der nächste Schritt „Zusage-Mail wurde nie ausgelöst", direkt in der Nächster-Schritt-Zeile den bereits vorhandenen Erneut-senden-Aufruf anbieten (`resendRegistrationInvite`, erzeugt frischen Token und umgeht den Interview-Schutz bewusst).

## Technische Details

- Betroffene Dateien: `src/lib/application-stage.functions.ts`, `src/lib/interview-engine.server.ts`, `src/lib/mail-next-step.ts`, `src/routes/admin.bewerbungen.tsx`, `src/components/mail/MailChain.tsx`.
- Keine Migration nötig; die Spalten `invite_mail_status/_error/_at` existieren bereits (Migration `20260803000000_application_invite_mail_status.sql`).
- Neue Protokollzeilen laufen unter dem Vorlagennamen `registration_invitation`, der bereits Teil des Zusage-Kettenschritts ist — dadurch wird ⏱ automatisch zu ⏭/⚠ mit Klartextgrund.
- Danach: Portal-Server deployen (Backend-Funktionen bleiben unverändert).