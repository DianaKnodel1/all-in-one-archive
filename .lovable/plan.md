## Befund

Die Erinnerungsmail 30 Minuten vor dem Termin läuft über die Funktion `send-appointment-reminders` (Cron alle 10 Minuten, Kandidatenfenster „Termin startet in 25–40 Minuten").

Für einen Termin um **01:00 Uhr** müsste die Mail gegen **00:30 Uhr** rausgehen. Genau das verhindert die zentrale Versandkontrolle: Erinnerungen dürfen nur im **Sendefenster 06:00–22:00 Uhr (Europe/Berlin)** verschickt werden (`_shared/limits.ts`, `_shared/send-guard.ts`). Der Versand wurde also bewusst blockiert und als `skipped` mit Grund `outside_send_window` protokolliert — kein SMTP- oder Cron-Fehler.

Dazu passt: Buchungen sind inzwischen bis 23:59 Uhr möglich, das Sendefenster wurde nie mitgezogen. Jeder Termin zwischen 00:00 und 06:30 Uhr bekommt derzeit keine Erinnerung.

## Vorschlag

1. **Bestätigen** (Backend-Server, nur lesend): Prüfen, ob für diesen Termin ein `skipped`-Eintrag mit `skip_reason = outside_send_window` in `email_send_log` steht. Damit ist die Ursache belegt, bevor etwas geändert wird.

2. **Termin-Erinnerung vom Sendefenster ausnehmen.** Diese Mail ist kein Werbe-Reminder, sondern gehört zum gebuchten Termin — der Empfänger erwartet sie exakt zu dieser Uhrzeit. In `send-appointment-reminders` wird die Prüfung deshalb auf die Art „terminbezogen" umgestellt: **Stunden- und Tageskontingent (150/h, 2.400/Tag) bleiben aktiv**, nur die Uhrzeit-Sperre entfällt. Die übrigen Reminder (Nachfass, Onboarding, Registrierung) bleiben unverändert bei 06–22 Uhr.

3. **Nachträglich verschickte Mails vermeiden:** Da das Zeitfenster eng ist (25–40 Min), gibt es kein Nachholen alter Termine — nur künftige Termine profitieren.

4. **Prüfskript erweitern:** `scripts/check-mail-health.sh` bekommt eine Ausgabe „Erinnerungen der letzten 24 h nach Ergebnis (gesendet/übersprungen + Grund)", damit solche stillen Blockaden sofort sichtbar sind.

5. **Deploy:** Backend-Server (`scripts/deploy-backend-local.sh`), danach Gegenprobe mit einem Testtermin in ~35 Minuten.

### Technische Details

- `supabase/functions/_shared/send-guard.ts`: neue Versandart neben `transactional`/`reminder`, die das Zeitfenster überspringt, Kontingente aber weiterhin zählt und jede Entscheidung wie bisher in `email_send_log` schreibt.
- `supabase/functions/send-appointment-reminders/index.ts`: `guardSend({ kind: ... })` auf die neue Art umstellen.
- Keine Datenbank-Migration nötig.

### Offene Frage

Falls du Erinnerungen nachts bewusst **nicht** willst, wäre die Alternative, stattdessen das Buchungsfenster auf 06:00–22:00 zu begrenzen. Sag kurz Bescheid, welche Variante dir lieber ist — Standard ist der Vorschlag oben (Erinnerung immer, passend zum Termin).
