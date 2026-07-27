## Problem

Sobald der Bewerber absendet, erscheint die „…"-Tippblase der KI sofort — das wirkt maschinell. Aktuell steuert im Chat ein einziger `loading`-State sowohl den Request als auch die Tippblase, deshalb springt sie ohne Pause an.

## Lösung

Zwischen „Nachricht abgeschickt" und „KI tippt" eine kurze Lesepause einbauen, wie in echten Messengern:

1. **Lesepause:** Nach dem Absenden bleibt es 1,2–2,5 Sekunden (leicht zufällig, damit es nicht getaktet wirkt) still — keine Tippblase, kein „schreibt …" im Header.
2. **Danach Tippblase:** Erst dann erscheinen die drei Punkte und der Header-Status wechselt auf „Merlin schreibt …".
3. **Antwort-Timing bleibt:** Die bestehende Tipp-Simulation (ca. 35 ms pro Zeichen, gedeckelt bei 6 s) bleibt unverändert; die Lesepause wird darauf angerechnet, damit lange KI-Antworten nicht spürbar länger dauern als heute.
4. Kommt die Antwort schneller als die Lesepause, wird trotzdem kurz getippt, bevor die Nachricht erscheint — es gibt keinen Sprung ohne Tippblase.
5. Gleiche Logik zusätzlich für die erste Begrüßungsnachricht beim Gesprächsstart, damit der Einstieg ebenfalls natürlich wirkt.

Der Eingabe-Button bleibt währenddessen deaktiviert, damit keine Doppel-Sendungen entstehen.

## Technische Details

- Datei: `src/routes/interview.$appId.tsx`
- Neuer State `typing` (getrennt von `loading`); die Tippblase (Zeilen ~324) und der Header-Status (Zeile ~237) hängen künftig an `typing` statt an `loading`.
- In `send()` ein `setTimeout` mit zufälliger Dauer (1200–2500 ms) setzen, das `typing` aktiviert; Timer beim Unmount bzw. beim Rendern der Antwort sauber aufräumen.
- Die vorhandene `targetMs`-Berechnung bleibt bestehen und wird als Untergrenze gegen die Lesepause verrechnet.
- Konstanten (`READ_DELAY_MIN_MS`, `READ_DELAY_MAX_MS`) oben in der Datei, damit die Werte leicht anpassbar sind.

## Nebenbefund

Im Screenshot steht noch „Sabine Schneider · personalservice-gmbh.de". Das ist der Branding-Fix aus dem letzten Schritt — der ist im Code, aber auf `portal.bv-agentur.com` offenbar noch nicht deployed. Nach dem nächsten Portal-Deploy sollte dort „Merlin Schneider" mit Profilbild und BV-Agentur stehen.
