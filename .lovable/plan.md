## Ergebnis der Prüfung

Typprüfung läuft sauber durch (0 Fehler). Die drei Fixes sind im Code so umgesetzt, wie besprochen — nachgelesen, nicht angenommen:

- `recordInviteAttempt` (interview-engine.server.ts, Z. 405–444): liest vor einem „übersprungen" den aktuellen Status und stuft ein bereits erfolgreiches „gesendet" nicht mehr herab. Fehlschläge dürfen weiterhin überschreiben — richtig so.
- `resendRegistrationInvite` (application-stage.functions.ts, Z. 160–211): prüft ohne `confirmDuplicate` die letzten 20 Stunden im E-Mail-Protokoll und gibt `{ sent:false, reason:"recent_invite", lastSentAt }` zurück, statt zu senden.
- `MailChain.tsx` (Z. 69–86, 134–153): fängt `recent_invite` ab und zeigt den Bestätigungsdialog mit Datum; erst „Trotzdem senden" löst mit `confirmDuplicate: true` aus.
- Herkunft (`ai_accept_invite` / `admin_stage_change` / `manual_resend`) wird bis in die Protokoll-Metadaten durchgereicht.
- `mail-next-step.ts` unterscheidet die drei Fälle (nie ausgelöst / übersprungen / fehlgeschlagen) und bietet jeweils `send_invite` an.

## Go — mit einer Bedingung

Die Spalten `invite_mail_status/_error/_at` sind Voraussetzung; von hier aus ist nicht prüfbar, ob die Migration auf dem produktiven Backend angewendet ist. Ohne sie schlagen die Status-Updates still fehl und die Zeile bleibt auf „nie ausgelöst".

Reihenfolge:
1. Backend-Server: `bash scripts/migrate.sh`
2. Kontrolle: `bash scripts/diagnose-invite-mail.sh --local <E-Mail>` — es darf kein „Migration fehlt" mehr erscheinen
3. Portal-Server deployen

## Ein Punkt zum Feinschliff (kein Blocker)

Jede erneute Stufenänderung auf „Zusage" schreibt eine weitere `skipped`-Zeile ins E-Mail-Protokoll. Das ist gewollt für die Nachvollziehbarkeit, kann bei häufigem Umsetzen aber das Mail Center und den Dubletten-Hinweis optisch aufblähen. Optionale Verbesserung für später: eine `skipped`-Zeile pro Bewerbung und Grund nur einmal je 20 Stunden schreiben (gleiche Frist wie der Dublettenschutz).

Sag Bescheid, wenn ich diesen Feinschliff noch vor dem Deploy einbauen soll — sonst: Go.
