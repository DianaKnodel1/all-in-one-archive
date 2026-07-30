## Ziel

Der Mitarbeiter startet und durchläuft die WebID-Identifizierung **aus dem Portal heraus**. Die Identifizierung selbst läuft unverändert bei WebID — mit deren Original-Oberfläche und Original-Hinweistexten. Das Portal liefert nur den Rahmen: Vorgangsnummer, Start, Rückkehr, Status.

## Wichtige technische Einschränkung vorab

WebID sendet auf seinen Ident-Seiten Schutz-Header (`X-Frame-Options` / `CSP frame-ancestors`), die das Einbetten in fremde Seiten verhindern. Zusätzlich erlauben Browser Kamerazugriff in fremden iFrames nur eingeschränkt. Deshalb wird zweistufig gebaut:

1. **Versuch: eingebettetes Fenster** im Portal (iFrame mit `allow="camera; microphone"`).
2. **Automatischer Fallback:** öffnet sich das Fenster nicht (Schutz-Header greift), startet WebID in einem eigenen Browser-Fenster, während das Portal daneben die Station-Seite mit Fortschritt offen hält.

Das ist keine Notlösung, sondern der übliche Weg — auch Banken binden WebID so ein. Für ein echtes Inline-SDK bräuchte es einen eigenen Vertrag; das lässt sich später ohne Umbau nachrüsten.

## Was gebaut wird

**1. Neue Portal-Seite „WebID-Station"**
Eigene Route unter dem Auftrag. Aufbau:

```text
┌─────────────────────────────────────────┐
│ WebID-Identifikation · Deutsche Bank    │
│ Vorgangsnummer: 4711-ABCD    [Kopieren] │
├──────────────────────┬──────────────────┤
│                      │ Schritt 1 ✓      │
│   WebID-Oberfläche   │ Schritt 2 ●      │
│   (eingebettet oder  │ Schritt 3 ○      │
│    separates Fenster)│                  │
│                      │ Checkliste:      │
│                      │ ☐ Ausweis        │
│                      │ ☐ Licht          │
├──────────────────────┴──────────────────┤
│ [Identifikation abgeschlossen]          │
└─────────────────────────────────────────┘
```

- Kein Nachbau der WebID-Oberfläche, keine veränderten Warntexte — WebID rendert sich selbst.
- Seitlich der Portal-Kontext: Vorgangsnummer, Zugangsdaten (falls hinterlegt), Checkliste, Ansprechpartner.

**2. Start-Logik**
Der „Identifikation starten"-Button baut die WebID-Ziel-URL mit der Vorgangsnummer zusammen und setzt den Auftrag automatisch auf `gestartet` (inkl. Zeitstempel). Auf dem Handy wird zusätzlich der App-Deep-Link angeboten, weil Kamera-Ident dort zuverlässiger läuft.

**3. Rückkehr & Abschluss**
Nach dem Ident kommt der Mitarbeiter zurück auf die Station-Seite und bestätigt den Abschluss. Optional lässt sich ein Nachweis (Screenshot/PDF der WebID-Bestätigung) hochladen — der Upload-Mechanismus des Auftragssystems wird wiederverwendet. Status geht auf `bestaetigt`, der Admin prüft und setzt auf `geprueft`.

**4. Konfigurierbare WebID-Ziel-URL**
Die Basis-URL wird nicht fest im Code stehen, sondern pro Auftrag bzw. als Einstellung hinterlegbar sein — falls der Auftraggeber (Bank) eine eigene WebID-Einstiegs-URL vorgibt, wird sie dort eingetragen. Damit ist auch der spätere Wechsel auf eine echte API-Anbindung nur ein Feldwechsel.

**5. Admin-Sicht**
In der Auftragsübersicht: Vorgangsnummer, Auftraggeber, Status-Badge und Zeitstempel (gestartet/bestätigt), plus Button „Nachbesserung anfordern" über den vorhandenen Review-Workflow.

## Technische Details

- Neue Route `src/routes/_employee/tasks.$assignmentId.webid.tsx` als Vollbild-Station.
- `src/components/WebIdTaskCard.tsx` wird zur Einstiegskarte umgebaut (Vorgangsnummer + Button „Im Portal starten") und verlinkt auf die Station.
- Neue Komponente `src/components/WebIdStationFrame.tsx`: iFrame mit `allow="camera; microphone; geolocation"`, Load-Timeout-Erkennung, automatischer Popup-Fallback via `window.open`.
- Neue Spalte `webid_start_url` auf `task_assignments` (Migration mit GRANTs analog zu den bestehenden WebID-Spalten), gepflegt in `AssignmentIndividualData.tsx`.
- Statuswechsel laufen über die bestehende `task_assignments`-Update-Logik, keine neue Auth-Ebene nötig.
- Der bestehende Block-Typ `webid` im Auftrags-Builder bleibt und verweist künftig auf die Station.

## Was bewusst nicht gebaut wird

Keine Nachbildung der WebID-Oberfläche, keine ersetzten oder abgeschwächten Hinweistexte, keine Erfassung von Ausweisdaten im Portal. Ausweis, Selfie und Prüfung bleiben vollständig bei WebID — sonst wäre die Identifizierung für den Auftraggeber wertlos und rechtlich angreifbar.
