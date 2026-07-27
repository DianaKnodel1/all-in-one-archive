## Ziel

1. Im Landing-Generator sofort sehen, welche Vermittlungs-Seite auf welche Fast-Track-Seite weiterleitet (z. B. „Personalservice → BV-Agentur").
2. Die **Termin-Verfügbarkeiten** beider verknüpfter Seiten sind identisch — egal ob der Bewerber über die Vermittlung oder direkt über Fast-Track bucht.

## Teil 1 — Verknüpfung sichtbar machen

In `src/routes/admin.landing-generator.tsx`:
- Neue Spalte „Verknüpfung" in der Landing-Liste. Bei Vermittlungs-Landings mit gesetzter Weiterleitung: `Personalservice → BV-Agentur`. Bei der Ziel-Fast-Track-Landing die Gegenrichtung: `← Personalservice`.
- Auch im Auswahlfeld „Weiterleitung nach CTA-Klick" bleibt es wie bisher, ergänzt um einen Hinweis, dass die Terminzeiten geteilt werden.
- Rein Anzeige/Frontend, keine Datenänderung.

## Teil 2 — Terminzeiten synchron halten

Regel: Vermittlungs-Landing und die verknüpfte Fast-Track-Landing bilden ein Paar mit **einem** Zeitraster.

- In `src/routes/admin.verfuegbarkeit.tsx`: Wenn die gewählte Landing zu einem Paar gehört, wird oben ein Hinweis eingeblendet („Zeiten gelten auch für BV-Agentur") und beim Speichern wird die Partnerseite mitgepflegt.
- In `src/lib/appointments.functions.ts` (`saveAvailabilityRules`, Terminplan-Einstellungen, Ausnahmen): nach dem Speichern werden Wochenregeln, Slot-Dauer, Puffer, Vorlaufzeit, Buchungsfenster, Zeitzone und Sperrtage auf den Terminplan der verknüpften Landing gespiegelt. Existiert dort noch keiner, wird er automatisch angelegt und aktiviert.
- Einmaliger Abgleich für die bestehenden Paare (z. B. Personalservice ↔ BV-Agentur), damit die aktuell abweichenden 09:00–11:30 sofort auf die gewünschten Zeiten laufen.

Damit spielt es keine Rolle mehr, welchen Kalender die Buchungslogik wählt — beide enthalten dieselben Zeiten.

## Technische Details

- Paar-Ermittlung über `landing_pages.linked_fasttrack_landing_id` (beide Richtungen).
- Spiegelung serverseitig in den bestehenden Admin-Server-Funktionen (`requireSupabaseAuth`, Admin-Prüfung bleibt), damit sie auch bei Bearbeitung über andere Wege greift.
- Keine Änderung an `get_schedule_for_application` / `book_appointment_by_token` nötig — die Priorität bleibt, die Daten sind nur nicht mehr unterschiedlich.
- Der einmalige Abgleich bestehender Paare erfolgt über eine Migration (Kopie der Regeln der jeweils führenden Vermittlungs-Landing).

## Randnotiz

Der Fehler `scripts/check-mail-templates.sh: No such file or directory` auf dem Backend-Server kommt daher, dass das Repo dort nicht aktualisiert wurde (`git pull` scheiterte an fehlender DNS-Auflösung für github.com). Das ist unabhängig von diesem Plan; ich kann das danach separat angehen.
