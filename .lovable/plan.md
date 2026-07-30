## Ziel

Ein Auftrag im Mitarbeiter-Portal, der eine Identifikation über die WebID-App abbildet: Der Admin hinterlegt pro Mitarbeiter eine **Vorgangsnummer** (und optional Auftraggeber, z. B. „Deutsche Bank"), der Mitarbeiter sieht sie im Portal, startet WebID, und meldet den Abschluss zurück.

Kein WebID-Vertrag/API-Key nötig — die Identifikation läuft in der WebID-App, das Portal führt und dokumentiert nur den Vorgang.

## Was gebaut wird

**1. Admin: Auftragsdaten pro Mitarbeiter**
Im bestehenden Bereich „Individuelle Daten" der Auftragszuweisung kommen Felder dazu:
- Vorgangsnummer (Pflicht für WebID-Aufträge)
- Auftraggeber / Bank (Freitext, z. B. Deutsche Bank)
- optional Zugangsdaten (E-Mail/Passwort) und Hinweistext — Felder sind in der Datenbank bereits vorhanden, werden bisher nur nicht angezeigt.

**2. Mitarbeiter: geführter WebID-Ablauf im Auftrag**
Eine neue WebID-Karte in der Auftragsansicht mit klaren Schritten:
1. WebID-App laden (App-Store-/Play-Store-Links, plus Web-Variante)
2. Vorgangsnummer groß dargestellt mit „Kopieren"-Button
3. „Identifikation starten" — öffnet WebID (Deep-Link mit Vorgangsnummer, Fallback: Web-Seite)
4. Checkliste (Ausweis bereithalten, gute Beleuchtung, Datenschutz-Hinweis)
5. „Identifikation abgeschlossen" bestätigen — setzt den Auftrag auf „eingereicht", optional Screenshot-/PDF-Upload als Nachweis

**3. Neuer Baustein für den Auftrags-Builder**
Ein Block-Typ „WebID-Identifikation", damit du den Schritt beliebig in eigene Auftragsvorlagen einbauen kannst (statt fest verdrahtet).

**4. Status & Nachverfolgung**
Der Admin sieht in der Auftragsübersicht Vorgangsnummer + Status (offen / gestartet / vom Mitarbeiter bestätigt / geprüft) und kann bestätigen oder Nachbesserung anfordern — über den vorhandenen Review-Workflow.

## Technische Details

- Datenbank: `task_assignments.individual_case_number`, `individual_email`, `individual_password`, `individual_hint` existieren bereits; ergänzt wird eine Migration für `webid_client_name` und `webid_status` (+ `webid_started_at`, `webid_confirmed_at`) inkl. GRANTs/RLS analog zu den bestehenden Spalten.
- Frontend: neue Komponente `src/components/WebIdTaskCard.tsx`, eingebunden in `src/routes/_employee/tasks.$assignmentId.tsx`; Admin-Felder in `src/components/AssignmentIndividualData.tsx` und Anzeige in `AssignmentIndividualDataView.tsx`.
- Neuer Block-Typ `webid` in `src/lib/task-blocks.ts` + Rendering im Builder und in der Mitarbeiter-Ansicht.
- Deep-Link/Web-URL zu WebID wird als konfigurierbarer Wert gehalten, damit eine spätere echte WebID-API (Auftrag anlegen + Webhook-Status) ohne Umbau ergänzt werden kann.

## Später möglich (nicht Teil dieses Schritts)

Echte WebID-REST-Anbindung: Portal legt den Ident-Vorgang automatisch an, erhält die Vorgangsnummer/Ident-URL zurück und bekommt den Abschluss per Webhook — dafür braucht es Vertrag, Kunden-ID und API-Key.
