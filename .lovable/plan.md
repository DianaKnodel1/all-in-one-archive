## Ziel

Der Mitarbeiter startet und beendet den WebID-Auftrag vollständig aus dem Portal heraus — ohne zweites Browserfenster, ohne 5-Sekunden-Wartezeit, ohne dass er selbst etwas umschalten muss. Die Identifizierung läuft weiterhin bei WebID, mit deren Oberfläche und deren Hinweistexten.

## Was sich ändert

Heute: iFrame → 5 Sekunden warten → Popup. Der Mitarbeiter sieht erst einen Ladebalken, dann springt ein Fenster auf.

Künftig: Übergabe im selben Tab. Ein Klick auf „Identifikation starten" führt direkt zu WebID; nach Abschluss kommt er über einen Rückkehr-Link wieder auf der Station-Seite an, die den Auftrag exakt dort weiterführt, wo er war.

```text
Portal · Auftragsseite
      │  [Identifikation starten]
      ▼
Portal · Station (Vorbereitung)
   Vorgangsnummer, Checkliste, Was passiert jetzt
      │  [Weiter zu WebID]   → Status: gestartet
      ▼
WebID (Original-Oberfläche, gleicher Tab)
      │  fertig
      ▼
Portal · Station (Rückkehr)
   „Identifikation abgeschlossen" + optionaler Nachweis
      │
      ▼
Status: bestätigt → Admin prüft → geprüft
```

## Einzelteile

**1. Vorbereitungs-Ansicht auf der Station**
Bevor übergeben wird, zeigt das Portal in eurem eigenen Branding und mit euren eigenen Texten: Vorgangsnummer groß + Kopierbutton, Zugangsdaten, Checkliste (Ausweis bereit, Licht, ruhige Umgebung, ca. 5 Minuten Zeit), und eine kurze Erklärung, was als Nächstes passiert. Das ist der Teil, den ihr frei textlich gestalten könnt — er gehört euch, nicht WebID.

**2. Übergabe statt Einbetten**
Der `WebIdStationFrame` mit iFrame, Timeout-Erkennung und `window.open`-Fallback entfällt. Stattdessen: Navigation im selben Tab, vorher Status auf `gestartet` mit Zeitstempel. Auf dem Handy zusätzlich der App-Deep-Link, weil die Kamera dort zuverlässiger ist.

**3. Rückkehr**
Die Station merkt sich, dass eine Übergabe lief (Zustand am Auftrag, nicht im Browser). Kommt der Mitarbeiter zurück auf `/tasks/<id>/webid`, sieht er direkt die Abschluss-Ansicht: „Identifikation abgeschlossen" plus optionaler Nachweis-Upload. Bricht er ab, kann er jederzeit erneut starten.

**4. Optionale Einbettung bleibt möglich**
Falls WebID eure Portal-Domain irgendwann für echte Einbettung freischaltet, reicht ein Schalter am Auftrag („inline erlaubt") — der Übergabeweg bleibt Standard, die Station kann dann inline rendern. Kein Umbau nötig.

## Technische Details

- `src/routes/_employee/tasks_.$assignmentId.webid.tsx`: zwei Ansichten (Vorbereitung / Rückkehr), gesteuert über `webid_status`.
- `src/components/WebIdStationFrame.tsx`: wird entfernt bzw. auf den optionalen Inline-Fall reduziert; kein Timeout, kein Popup.
- `src/lib/webid.ts`: `buildWebIdStartUrl` bleibt unverändert (Platzhalter `{vorgangsnummer}`).
- Statuswechsel weiterhin über die bestehende `task_assignments`-Update-Logik; keine neue Spalte nötig.

## Was bewusst nicht gebaut wird

Kein Nachbau der WebID-Oberfläche, keine ersetzten oder abgeschwächten Warnhinweise, kein Verbergen des Anbieters gegenüber dem Mitarbeiter, keine Erfassung von Ausweisdaten im Portal. Ausweis, Selfie und Prüfung bleiben vollständig bei WebID.
