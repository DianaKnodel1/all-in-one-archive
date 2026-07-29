## Was im letzten Schritt gefixt wurde

Ausgangsproblem: In der Bewerberliste stand dauerhaft „Zusage-Mail steht aus", obwohl die Bewerbung angenommen war.

Ursache (im Code bestätigt): Beim Setzen der Zusage bricht `src/lib/application-stage.functions.ts` ab, sobald bereits ein Registrierungs-Token existiert (`already_invited`) — früher ohne Mail **und ohne Protokolleintrag**. Für die Oberfläche sah das aus wie „nie passiert".

Umgesetzt:
- `recordInviteAttempt()` in `interview-engine.server.ts`: schreibt jeden Versuch (sent / failed / skipped) an die Bewerbung (`invite_mail_status/_error/_at`) und legt bei skipped/failed zusätzlich eine Zeile im E-Mail-Protokoll an.
- Der `already_invited`-Abbruch protokolliert jetzt „übersprungen" mit Grund und Token-Datum.
- `mail-next-step.ts` unterscheidet jetzt drei Fälle statt einem Sammeltext: nie ausgelöst / übersprungen / fehlgeschlagen — jeweils mit Grund.
- „Jetzt senden"-Knopf direkt in der Zeile (`MailChain.tsx`) und die Statusspalten werden aus der Bewerbung mitgeladen (`AdminDataContext.tsx`, `admin.bewerbungen.tsx`).

## Verbleibende Punkte, die ich beim Gegenlesen gefunden habe

**1. Ein erfolgreicher Versand wird nachträglich als „übersprungen" überschrieben (Fehlalarm)**
`recordInviteAttempt` schreibt den Status bedingungslos. Wurde die Zusage-Mail früher wirklich versendet und ändert später jemand die Stufe erneut, steht an der Bewerbung „skipped" — Diagnose-Skript und Tooltip behaupten dann fälschlich, es sei nichts rausgegangen.
Fix: „sent" nicht mehr herabstufen; ein späteres „skipped" nur schreiben, wenn der aktuelle Status nicht „sent" ist.

**2. „Jetzt senden" kann Doppelversand erzeugen**
Der Knopf ruft `resendRegistrationInvite` immer mit `force: true`. Das umgeht bewusst die Interview-Prüfung, erzeugt aber bei jedem Klick einen **neuen Token** und eine neue Mail — ohne Rückfrage und ohne Dublettenprüfung.
Fix: Rückfrage-Dialog vor dem Senden; wenn in den letzten 20 Stunden schon eine `registration_invitation` an dieselbe Adresse gesendet wurde, Hinweis anzeigen und nur nach ausdrücklicher Bestätigung senden (gleiche Regel wie die zentrale Dublettenprüfung im Cron).

**3. Irreführende Herkunft im Protokoll**
Die Protokollzeile trägt immer `source: "ai_accept_invite"`, auch wenn der Abbruch aus einer Admin-Stufenänderung stammt. Erschwert später die Ursachensuche.
Fix: Quelle als Parameter durchreichen (`ai_accept_invite` / `admin_stage_change` / `manual_resend`).

**4. Zu verifizieren, nicht angenommen**
Ob die Spalten `invite_mail_status/_error/_at` auf dem produktiven Backend wirklich existieren, ist von hier aus nicht geprüft — die Migration `supabase/manual-migrations/20260803000000_application_invite_mail_status.sql` liegt vor, der Anwendungsstand ist offen. Erster Schritt bei der Umsetzung: mit `bash scripts/diagnose-invite-mail.sh --local <E-Mail>` gegenprüfen; erscheint dort wieder „Migration fehlt", zuerst `bash scripts/migrate.sh`.

## Technische Details

- `src/lib/interview-engine.server.ts`: `recordInviteAttempt(app, status, error, source)` — vor dem Downgrade den aktuellen `invite_mail_status` lesen; `source` in die Protokoll-Metadaten.
- `src/lib/application-stage.functions.ts`: Aufruf mit `source: "admin_stage_change"`.
- `src/lib/application-stage.functions.ts` (`resendRegistrationInvite`): optionales `confirmDuplicate`-Flag; ohne Flag Abbruch mit `{ sent:false, reason:"recent_invite", lastSentAt }`, wenn < 20 h ein erfolgreicher Versand protokolliert ist.
- `src/components/mail/MailChain.tsx`: Bestätigungsdialog, der `lastSentAt` nennt, bevor erneut gesendet wird.
- Danach Typecheck; Deployment wie gewohnt Backend-Server zuerst, dann Portal-Server.
