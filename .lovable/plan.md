## Ziel

Wenn die KI am Ende des Bewerbungsgesprächs eine Zusage erteilt, sieht der Bewerber die Zusage **sofort im Portal** — als Erfolgs-Screen im Stil der „Willkommen im Team"-E-Mail, inklusive „Jetzt registrieren"-Button mit demselben Registrierungs-Link, der auch per Mail rausgeht. Die E-Mail bleibt unverändert zusätzlich bestehen.

## Was gebaut wird

**1. Registrierungs-Link ans Frontend durchreichen**
- `sendRegistrationInviteAfterAiAccept` (in `src/lib/interview-engine.server.ts`) gibt zusätzlich `registration_link` zurück (der Link wird dort ohnehin schon erzeugt).
- Gleiches in der Chat-Route `src/routes/api/public/interview-chat.ts` (eigene Kopie der Funktion).
- Die JSON-Antwort beim Gesprächsende enthält dann: `recommendation`, `application_status` und `invite_mail.registration_link`.
- Wichtig: Der Link wird nur zurückgegeben, wenn die bestehende Schutzlogik (abgeschlossenes Interview) greift — an der Guard-Logik ändert sich nichts.

**2. Zusage-Screen im Chat-Interview** (`src/routes/interview.$appId.tsx`)
- Neuer Zustand: nach Gesprächsende mit `recommendation === "invite"` wird über dem Chat ein Erfolgs-Panel eingeblendet (kurze Verzögerung nach der letzten KI-Nachricht, damit es nicht abrupt wirkt).
- Inhalt analog zur E-Mail:
  - 🎉 „Willkommen im Team!" / „Wir freuen uns, dass Sie dabei sind."
  - „Ihr Profil hat uns überzeugt – lassen Sie uns direkt starten!"
  - Box „Wie geht es weiter?" mit den zwei nummerierten Schritten (Registrieren im Mitarbeiterportal, danach Onboarding)
  - Primär-Button „Jetzt registrieren" → `registration_link`
  - Signatur mit dem echten Recruiter-Namen und Firmennamen der Landing Page (die Seite kennt beides bereits), plus Hinweis „Bereits registriert? Zum Login"
- Fallback: Kommt kein `registration_link` zurück (z. B. Mailversand-Fehler), zeigt der Screen die Zusage trotzdem an, mit Hinweis „Sie erhalten den Registrierungslink per E-Mail".
- Bei `reject`/`unsure` ändert sich nichts — es bleibt beim bisherigen „Gespräch beendet".

**3. Gleiches Verhalten im Voice-Interview** (`src/routes/interview.voice.$appId.tsx`)
- Derselbe Erfolgs-Screen nach Gesprächsende, als gemeinsame Komponente `src/components/interview/ZusageCard.tsx`, damit Chat und Voice identisch aussehen.

**4. Optik**
- Kein Hardcoding von Farben: Styling über die bestehenden Design-Tokens/Portal-Theme-Klassen, Layout am Screenshot orientiert (zentrierte Karte, Emoji-Header, graue Schritt-Box, breiter Primär-Button).

## Technische Details

- Betroffene Dateien: `src/lib/interview-engine.server.ts`, `src/routes/api/public/interview-chat.ts`, `src/routes/interview.$appId.tsx`, `src/routes/interview.voice.$appId.tsx`, neu `src/components/interview/ZusageCard.tsx`.
- Keine Datenbank-Migration nötig, keine Änderung an Mail-Templates oder Crons.
- Abschluss mit `tsgo`-Typecheck; danach normales Deploy auf dem Portal-Server (Backend-Deploy nicht erforderlich, da keine Edge Function betroffen ist).
