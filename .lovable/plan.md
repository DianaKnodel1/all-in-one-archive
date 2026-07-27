## Was der Screenshot zeigt

Gebucht wurde 01:00 Uhr (deutsche Zeit, 28.07.). In der Mail steht „Montag, 27. Juli 2026, 23:00 Uhr“ — exakt 2 Stunden früher, also **UTC statt Europe/Berlin**. Im Portal (Buchungsseite/Bestätigungskarte) wird die Zeit korrekt angezeigt, weil dort der Browser formatiert.

Im Code ist die Absicht richtig: `send-booking-confirmation` formatiert mit `timeZone: "Europe/Berlin"`. Dass die Mail trotzdem UTC zeigt, hat eine von zwei Ursachen — das muss zuerst gemessen werden, ich rate hier nicht:

1. Der selbstgehostete Mail-Dienst hat keine vollständigen Zeitzonendaten, wodurch die Zeitzonen-Angabe still ignoriert wird und UTC herauskommt.
2. Auf dem Backend-Server läuft noch eine ältere Version der Versandfunktion ohne die Zeitzonen-Angabe.

## Vorgehen

**Schritt 1 — Ursache messen (Backend-Server, read-only)**
- Im Mail-Container prüfen, ob eine Uhrzeit mit deutscher Zeitzone korrekt formatiert wird.
- Parallel prüfen, ob die dort liegende Version der Bestätigungsfunktion die Zeitzonen-Angabe überhaupt enthält.

Ergebnis entscheidet: nur neu ausrollen (Fall 2) oder Code härten (Fall 1).

**Schritt 2 — Zeitformatierung unabhängig vom Runtime machen**
Eine gemeinsame Hilfsfunktion für alle Mail-Funktionen, die
- zuerst die normale Zeitzonen-Formatierung versucht,
- selbst verifiziert, ob die Zeitzone wirklich angewendet wurde,
- und andernfalls den deutschen Offset (Sommer-/Winterzeit korrekt) manuell berechnet.

Damit ist die Uhrzeit richtig, egal wie der Server konfiguriert ist.

**Schritt 3 — Auf alle betroffenen Mails anwenden**
- Terminbestätigung (inkl. Betreff und Vorschautext)
- 30-Minuten-Erinnerung vor dem Termin
- „Termin verpasst“-Erinnerung
- Mail-Vorschau im Admin (damit Vorschau und echter Versand identisch sind)

**Schritt 4 — Kalendereintrag (.ics) präzisieren**
Der Anhang nutzt UTC-Zeitstempel mit `Z` — das ist technisch korrekt und Kalender rechnen es richtig um. Zusätzlich wird die Zeitzone als `TZID` mitgegeben, damit Outlook/Apple die Zeit auch in Textvorschauen richtig anzeigen.

**Schritt 5 — Bestehende Buchung prüfen**
Kurzabfrage, ob der gespeicherte Termin in der Datenbank korrekt ist (Erwartung: ja, gespeichert ist 23:00 UTC = 01:00 deutsche Zeit). Falls doch die Speicherung schiefliegt, wird das separat gefixt — dann wäre auch die Terminplanung selbst betroffen.

## Technische Details

- Neues Modul `supabase/functions/_shared/format-datetime.ts` mit `formatAppointmentDate/Time(date)`; Selbstprüfung über `Intl.DateTimeFormat().formatToParts` plus DST-Fallback (letzter Sonntag im März/Oktober).
- Ersetzt die direkten `toLocaleDateString/toLocaleTimeString`-Aufrufe mit `APP_TZ` in `send-booking-confirmation`, `send-appointment-reminders`, `send-application-reminders`, `email-preview`.
- `buildIcs`: zusätzlich `VTIMEZONE`/`TZID`-Variante neben den bestehenden UTC-Werten.
- Danach Deployment: Portal `git pull && bash scripts/deploy.sh`, Backend Sync der Edge-Funktionen; Verifikation über einen Testversand.
