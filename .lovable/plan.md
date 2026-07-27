## Ausgangslage

Der Chat wurde beendet und im Portal wurde eine Zusage angezeigt, aber die Registrierungs-/„Willkommen im Team"-Mail kam nicht an.

Was ich im Code gesehen habe (bestätigt):
- Die Einladungsmail wird an drei Stellen ausgelöst (`interview-chat.ts` beim automatischen Ende, beim manuellen „end", und `interview-engine.server.ts` für Voice/Finalize) — jeweils nur wenn die KI-Empfehlung exakt `invite` lautet.
- Der Versand selbst läuft über die Edge-Funktion `send-invitation-email`. Schlägt sie fehl, wird das Ergebnis **nur in die Server-Konsole geloggt** und im API-Response mitgegeben — es landet **nicht** an der Bewerbung, nicht im Admin und (bei Invoke-Fehler) unter Umständen auch nicht in `email_send_log`.
- `interview-chat.ts` enthält eine eigene Kopie der Einladungslogik (ohne den `ref=`-Parameter und ohne den Guard aus der Engine) — zwei Codepfade, die auseinanderlaufen können.

Die eigentliche Ursache im konkreten Fall ist **noch nicht bestätigt**. Realistische Kandidaten: (a) Empfehlung war `unsure`, obwohl das Gespräch positiv endete, (b) SMTP des Mandanten fehlt/pausiert/535-Auth (bekanntes Thema bei mehreren Mandanten), (c) Edge-Funktion nicht erreichbar. Deshalb ist Schritt 1 reine Diagnose.

## Schritt 1 — Ursache feststellen (Diagnose-Skript)

Neues Skript `scripts/diagnose-invite-mail.sh` (läuft auf dem Backend-Server, `--local` via `docker exec ... psql`), Eingabe: E-Mail oder Bewerbungs-ID. Es zeigt:
- Bewerbung: `interview_status`, `interview_recommendation`, `interview_score`, `ai_decision`, `status`, `stage`, `interview_completed_at`
- ob ein `invitation_tokens`-Eintrag erzeugt wurde (Token da = Mailversuch lief, Token fehlt = gar nicht ausgelöst)
- alle `email_send_log`-Zeilen zu dieser Adresse (Status, `skip_reason`, `error_message`)
- SMTP-Zustand des Mandanten (`emails_paused`, Grund, ob SMTP-Daten vollständig)
- `activity_log`-Eintrag `bewerbung_ai_akzeptiert`

Damit ist eindeutig, ob es an der KI-Empfehlung, am Kontingent/Pause oder am SMTP hing.

## Schritt 2 — Ergebnis dauerhaft sichtbar machen

Damit so ein Fall nie wieder unsichtbar bleibt:
- Das Ergebnis des Einladungsversands wird nach jedem Versuch an der Bewerbung gespeichert (`invite_mail_status`, `invite_mail_error`, `invite_mail_at`) — neue Migration in `supabase/manual-migrations/` inkl. GRANTs.
- Schlägt der Versand fehl oder wird er übersprungen, wird zusätzlich ein `email_send_log`-Eintrag mit Status `failed`/`skipped` und Grund geschrieben (bisher nur Konsole).
- In der Admin-Bewerbungsansicht erscheint ein Badge „Einladung versendet" / „Einladung fehlgeschlagen: …" mit Button **Einladung erneut senden**.

## Schritt 3 — Doppelte Logik zusammenführen

Die lokale Kopie in `src/routes/api/public/interview-chat.ts` wird entfernt; alle Pfade nutzen `sendRegistrationInviteAfterAiAccept` aus `src/lib/interview-engine.server.ts` (inkl. `ref=`-Parameter und Guard). Ein Verhaltensunterschied zwischen Chat-Ende, „end"-Aktion und Voice entfällt damit.

## Schritt 4 — Zusage ohne Mail abfangen

Wenn die KI `invite` empfiehlt, der Mailversand aber scheitert, zeigt das Portal weiterhin die Zusage-Karte (der Registrierungslink funktioniert auch ohne Mail) — zusätzlich mit dem Hinweis „Die E-Mail ist unterwegs; nutzen Sie zur Sicherheit direkt diesen Button." Damit ist der Bewerber nie blockiert, selbst wenn SMTP klemmt.

## Technische Details

- Betroffene Dateien: `src/routes/api/public/interview-chat.ts`, `src/lib/interview-engine.server.ts`, `src/components/interview/ZusageCard.tsx`, Admin-Bewerbungsansicht, neues `scripts/diagnose-invite-mail.sh`, neue manuelle Migration.
- Kein Eingriff in die KI-Bewertung selbst — die Entscheidung `invite/unsure/reject` bleibt unverändert.
- Deployment wie gewohnt: Portal-Server `git pull` + `scripts/deploy.sh`, Backend-Server nur falls die Migration ansteht.
