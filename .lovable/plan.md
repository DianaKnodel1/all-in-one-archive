## Ziel
Bewerbungs-Interviewtermine und Mitarbeiter-/Auftragstermine werden zwei getrennte Admin-Seiten statt einer gemischten Ansicht.

## Neue Struktur
```text
/admin/appointments          -> "Mitarbeiter-Termine" (Auftrags-Buchungen, Tabelle wie bisher)
/admin/bewerbungstermine     -> "Bewerbungstermine" (Interview-Buchungen der Bewerber)
```

## Was gemacht wird

**1. Neue Seite `src/routes/admin.bewerbungstermine.tsx`**
- Enthält die bisherige Komponente `ApplicantInterviewAppointments` aus `admin.appointments.tsx`, als eigene Seite mit Überschrift „Bewerbungstermine" und Anzahl der Buchungen.
- Volle Liste statt der bisherigen Kürzung auf 8/6 Einträge, mit den zwei Blöcken „Kommende Interviews" und „Abgesagt / erledigt / No-Show".
- Status-Filter (alle / gebucht / abgesagt / abgeschlossen / nicht erschienen) oben rechts.

**2. `src/routes/admin.appointments.tsx` bereinigen**
- Einbindung von `ApplicantInterviewAppointments` entfernen, Komponente und Hilfsfunktion in die neue Datei verschieben.
- Titel auf „Mitarbeiter-Termine" ändern, Beschreibung anpassen (Auftrags-/Mitarbeiter-Buchungen).
- Rest (Termin erstellen, Zuweisen, Freischaltung) bleibt unverändert.

**3. Navigation `src/components/AdminLayout.tsx`**
- Bestehender Punkt „Bewerbungs-Termine" → `/admin/bewerbungstermine` (Bewerber-Interviews).
- Zusätzlicher Punkt „Mitarbeiter-Termine" → `/admin/appointments`.
- Beide im passenden Menü-Bereich (Bewerbungstermine bei den Bewerber-Punkten, Mitarbeiter-Termine bei den Mitarbeiter-Punkten).

## Technisches
- Reines Frontend/Routing, keine Datenbank- oder Backend-Änderung.
- Datenquellen bleiben getrennt wie bisher: `adminListAppointments` (Bewerber) bzw. `allBookings` aus `AdminDataContext` (Mitarbeiter).
- Danach Typecheck; Deploy nur Portal-Server nötig, kein Backend-Deploy.
