Deploy-Log ist sauber: Build ok, Release aktiviert (`20260729-054051`), `portal.service` läuft. Nur die üblichen Rollup-Hinweise zu `"use client"` in Fremdpaketen — unkritisch.

Von meiner Seite: **Go zum Gegenchecken.** Es sind keine Code-Punkte mehr offen; was noch aussteht, ist Konfiguration bzw. Beobachtung.

## Noch offene Punkte (kein Code)

1. **LH Marketing – SMTP-Login schlägt fehl (535)**
   Benutzer `info@l-h-marketing.de`, Passwort 15 Zeichen. Port 587 und 465 liefern beide „authentication failed". Passwort beim Anbieter neu setzen und in der Tenant-Verwaltung eintragen; nach erfolgreichem Test hebt sich die Pause automatisch auf.
   Hinweis: Das Passwort wurde einmal im Klartext in den Chat kopiert — bitte in jedem Fall wechseln.

2. **MuS Marketing, W3 Personal, ODB – keine SMTP-Daten hinterlegt**
   Diese Tenants können nicht senden, bis Zugangsdaten hinterlegt und der Test grün ist.

3. **Kontrolllauf nach dem Deploy** (in 40–50 Min, wie geplant)
   ```bash
   cd /opt/apps/portal-migrations && bash scripts/cleanup-duplicate-mails.sh --local
   ```
   Erwartung: keine neuen Gruppen mit heutigem Datum. Tauchen welche auf, greift eine Sperre nicht — Ausgabe schicken.

## Was du beim Gegenchecken sehen solltest

- **Mail Center**: keine `duplicate`/`superseded`-Zeilen in der Liste; Zähler oben nicht mehr aufgebläht; Warnbanner „mögliche Doppelversände" nur bei echten neuen Fällen.
- **Historie eines Bewerbers** (z. B. `s.julke@gmx.de`, `mannometer23@outlook.com`): grüner Haken bleibt sichtbar, darunter „⧉ n bereinigt".
- **Mail-Kette in der Bewerberliste**: 4 Punkte plus Zeile „➜ Nächster Schritt", graue Punkte mit Tooltip-Begründung.
- **Terminbestätigung**: Uhrzeit in Berliner Zeit, nicht UTC.
- **Termin-Reminder**: kommt auch außerhalb 06–22 Uhr (Sendefenster gilt nur für Kampagnen-Reminder).

## Falls beim Gegencheck etwas auffällt

Melde mir konkret: Screenshot plus Bewerber-Mailadresse und Uhrzeit. Dann gehe ich gezielt über `scripts/diagnose-mail-failures.sh` bzw. `scripts/diagnose-invite-mail.sh` in die Log-Zeilen.
