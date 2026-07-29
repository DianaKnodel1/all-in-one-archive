## Ausgangslage (geprüft)

Der Zusage-Screen mit Button „Jetzt registrieren" existiert bereits (`src/components/interview/ZusageCard.tsx`) und wird in `src/routes/interview.$appId.tsx` angezeigt, sobald die KI zusagt. Der persönliche Registrierungslink (`/register?token=…&ref=…`) kommt aus `sendRegistrationInviteAfterAiAccept` und wird über das Feld `invite_mail.registration_link` an das Portal zurückgegeben.

**Lücke:** Dieser Link wird nur bei den Aktionen `message` und `end` mitgeliefert. Lädt der Bewerber die Seite neu oder kommt später zurück (Aktion `init`), bleibt `registrationLink` leer — die Karte zeigt dann nur den Hinweis „Sie erhalten in wenigen Minuten eine E-Mail" **ohne Button**. Genau das wirkt so, als gäbe es den Button nicht.

## Was gebaut wird

1. **Link auch beim Laden/Neuladen liefern**
   In `src/routes/api/public/interview-chat.ts` (Aktion `init`, und generell bei bereits abgeschlossenem Interview mit Status `akzeptiert`): den bestehenden `invitation_tokens`-Eintrag der Bewerbung nachschlagen und daraus denselben Registrierungslink bauen wie beim Versand. Rückgabe als `invite_mail.registration_link`, damit die Karte den Button rendert.

2. **Linkaufbau vereinheitlichen**
   Die Portal-Domain-Auflösung (Fast-Track-Landing → Tenant-Domain → Fallback-Origin) aus `src/lib/interview-engine.server.ts` in eine kleine, wiederverwendbare Funktion herausziehen (z. B. `buildRegistrationLink(app, request)`), damit Versand-Mail und Portal-Anzeige garantiert identische Links nutzen.

3. **Portal-Seite absichern**
   In `src/routes/interview.$appId.tsx` den Link auch aus der `init`-Antwort übernehmen (aktuell nur bei `message`/`end`). Ist trotz Zusage kein Token vorhanden, wird ein Button auf die Portal-Registrierung ohne Token gezeigt statt gar kein Button — der Bewerber landet in jedem Fall auf der Registrierung.

4. **Button-Text/Ziel prüfen**
   Beschriftung „Jetzt registrieren", Ziel = Registrierungsseite des Mitarbeiterportals (`https://portal.<domain>/register?token=…`). Bleibt wie gehabt, nur jetzt immer sichtbar.

## Technische Details

- Betroffene Dateien: `src/routes/api/public/interview-chat.ts`, `src/lib/interview-engine.server.ts`, `src/routes/interview.$appId.tsx`, ggf. `src/components/interview/ZusageCard.tsx` (Fallback-Zweig ohne Token).
- Kein Datenbank-Migrationsbedarf: `invitation_tokens` existiert bereits inkl. `application_id`.
- Keine Änderung am Mailversand — die „Willkommen im Team"-Mail bleibt unverändert.
- Danach: Portal-Server deployen (`bash scripts/deploy.sh`).
