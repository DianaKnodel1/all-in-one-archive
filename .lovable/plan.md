## Ausgangslage (geprüft im Code)

- Eine Pause wird gesetzt: manuell über den Admin-Button (`emails_paused_by = manual:admin`) oder automatisch vom Domain-Health-Cron, wenn alle Domains eines Mandanten down sind (`auto:domain_down`). Historisch gibt es außerdem `auto:smtp_verify`.
- Aufgehoben wird sie **nur** manuell (Admin-Button „Freigeben" oder `scripts/tenant-pause-status.sh --release`). SMTP-Daten einzutragen ändert nichts.
- Zusätzliches Problem: Der SMTP-Test bricht bei pausierten Mandanten **vor** dem eigentlichen Test mit `TENANT_PAUSED` ab. Man kann also gar nicht nachweisen, dass die neuen Zugangsdaten funktionieren, solange die Pause aktiv ist — ein Henne-Ei-Problem.

## Was gebaut wird

**1. SMTP-Test läuft auch bei pausiertem Mandanten**
In `supabase/functions/smtp-test/index.ts` wird der harte Abbruch bei `emails_paused` entfernt. Der Pausen-Zustand wird stattdessen nur noch als Information in der Antwort mitgegeben (`was_paused`, `paused_by`, `paused_reason`), damit die Oberfläche darauf reagieren kann.

**2. Automatische Freigabe nach erfolgreichem Test**
Nach erfolgreichem `verify()` gilt:
- Pause stammt von `auto:domain_down`, `auto:smtp_verify` oder ist ohne Auslöser gesetzt → Pause wird automatisch aufgehoben (`emails_paused = false`, Grund/Zeitpunkt/Auslöser geleert), `tenant_smtp_health` auf `consecutive_fails = 0`, `last_verify_ok = true` gesetzt und ein Eintrag `emails_reaktiviert` ins `activity_log` geschrieben.
- Pause stammt von `manual:admin` → **bleibt bestehen**. Die Antwort enthält `resume_blocked: "manual"`, damit die Oberfläche klar sagt: SMTP ist in Ordnung, die Pause wurde bewusst vom Admin gesetzt und muss per Button freigegeben werden.

**3. Hinweis im Mandanten-Admin**
In `src/routes/admin.tenants.tsx`:
- Neue Badge/Zeile bei pausierten Mandanten, deren SMTP zuletzt erfolgreich geprüft wurde: „SMTP OK — pausiert, jetzt freigeben" mit direktem Freigeben-Button.
- Der bestehende Pausen-Badge zeigt zusätzlich den Auslöser an (manuell vs. automatisch), damit sofort klar ist, warum pausiert wurde.
- Nach dem SMTP-Test: Bei automatischer Freigabe eine Erfolgsmeldung „SMTP OK — Versand wieder freigegeben", bei manueller Pause die Meldung „SMTP OK — Pause wurde manuell gesetzt, bitte freigeben".

**4. Doku-Abgleich**
Kurzer Vermerk zu den Pausen-Auslösern und der neuen Auto-Freigabe in `scripts/tenant-pause-status.sh` (Kommentarkopf), damit das Skript nicht mehr das alte Verhalten beschreibt.

## Technische Details

- Betroffene Dateien: `supabase/functions/smtp-test/index.ts`, `src/routes/admin.tenants.tsx`, `scripts/tenant-pause-status.sh`.
- Keine Schemaänderung nötig; `tenant_smtp_health` und die `emails_paused_*`-Spalten existieren bereits.
- Der Edge-Function-Teil muss nach dem Deploy einmalig ausgerollt werden (`bash scripts/deploy-edge-function.sh smtp-test` auf dem Backend-Server).

## Für dich danach

MuS Marketing, W3 Personal und ODB brauchen zuerst SMTP-Zugangsdaten; UWK Consulting und ODB werden nach erfolgreichem SMTP-Test automatisch freigegeben, sofern die Pause nicht manuell gesetzt wurde.
