## Kurze Antwort

Nein — `verify-mail-matrix.sh` prüft nur **Existenz + Historie** (Function da? Cron aktiv? wie oft in 30 Tagen gesendet/fehlgeschlagen?). Es löst keine einzige Mail aus. Für „Bewerber bekommt Zusage → Mail geht wirklich raus" braucht es den Kettentest (`run-full-chain.sh`), und der hat aktuell Lücken.

## Was ich geprüft habe

- `send-application-reminders` kennt 7 Arten: `no_booking_24h/72h`, `no_show_24h`, `rebook_after_cancel_24h/72h`, `registration_pending_24h/72h`.
- `verify-mail-matrix.sh` listet davon nur 4 Zeilen — **`no_booking_72h`, `rebook_after_cancel_72h`, `registration_pending_24h` und `registration_pending_72h` fehlen komplett in der Matrix**. Genau „Zusage erhalten, aber nicht registriert" ist also bisher nicht in der Prüfung.
- `send-reminders` kennt `invite`, `confirm_email`, `complete_registration`, `no_recent_booking`, `domain_recovery`. In der Matrix fehlen `no_recent_booking` und `domain_recovery`.
- `complete_registration` greift auf `profiles.onboarding_status <> 'abgeschlossen'` — das ist die einzige Mail, die den Fall „registriert, aber Ausweis/Vertrag fehlt" abdeckt. Eine **eigene** Mail „Personalausweis fehlt" bzw. „Arbeitsvertrag nicht unterschrieben" existiert im Code nicht.

## Vorgehen

1. **Matrix vervollständigen** — `verify-mail-matrix.sh` um die 6 fehlenden Zeilen erweitern (`no_booking_72h`, `rebook_after_cancel_72h`, `registration_pending_24h/72h`, `no_recent_booking`, `domain_recovery`), damit aus 17 die tatsächlich implementierten ~23 Mails werden. Zusätzlich eine Auswertung direkt aus `application_reminder_log` je `reminder_kind` (nicht nur `email_send_log`), weil die Reminder dort mit ihrem Kind protokolliert werden.

2. **Kettentest lückenlos machen** — `run-full-chain.sh` bekommt die fehlenden Stufen:
   - Zusage erteilt, aber keine Registrierung nach 24h/72h → `registration_pending_24h/72h`
   - Registriert, Onboarding unvollständig (kein Ausweis/kein Vertrag) → `complete_registration`
   - E-Mail nicht bestätigt → `confirm_email`
   Jede Stufe: Zustand setzen → Dry-Run (nur Testbewerber fällig) → echter Send → Logzeile prüfen.

3. **Onboarding-Seite mitnehmen** — für Stufe „Mitarbeiter registriert, Dokumente fehlen" muss der Test ein `profiles`-Testprofil mit `onboarding_status='in_bearbeitung'`, ohne `contract_signed_at` und ohne verifizierte `kyc_verifications` anlegen und am Ende wieder aufräumen (`chain-99-cleanup.sql` erweitern).

4. **Ergebnisbericht** — Tabelle: Mail · Auslöser · Cron · Dry-Run fällig? · real gesendet? · Postfach-Eingang.

## Offene Frage vor der Umsetzung

Soll ich für „Ausweis fehlt" und „Arbeitsvertrag nicht unterschrieben" **eigene** Mails bauen (getrennte Texte, eigene Idempotenz), oder reicht dir die bestehende Sammel-Mail „Registrierung abschließen"? Das ist der einzige echte Feature-Punkt; alles andere ist Test-Abdeckung.

## Technische Details

Die neuen Kettenstufen arbeiten wie die bestehenden: nur Zeilen mit der Test-E-Mail werden manipuliert, `application_reminder_log` bzw. `reminder_log` wird je Kind gezielt geleert, damit die Idempotenz-Sperre den Wiederholungslauf nicht blockiert. Abbruch, sobald der Dry-Run mehr als den Testbewerber als fällig meldet. Für `complete_registration` wird zusätzlich ein Testeintrag in `profiles` benötigt (an einen Auth-User gebunden) — den räumt das Cleanup mit ab.
