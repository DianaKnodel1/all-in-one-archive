## Was ich geprüft habe (live)

- **gtm-strategies.de** (theme-tts-beratung): Das Bewerbungs-Modal öffnet sich, Formular + DSGVO-Checkbox sind da, keine JS-Fehler. Der Portal-Endpunkt `.../api/public/applications` antwortet korrekt (CORS ok, Validierung greift). Auffällig: Das Status-Feld im Formular heißt `ttsb-form-status`, das Skript setzt beim Absenden aber `lv-form-status` — Erfolgs- und Fehlermeldungen (z. B. „Bitte Datenschutz bestätigen“) sind dadurch praktisch unsichtbar. Für den Bewerber sieht es aus, als „passiere nichts“.
- **mus-marketing.de** (theme-nebula-flux):
  - Projekt-Karten laufen über den Rand: die Meta-Kacheln (Vergütung/Dauer/Plattform/Level) sind breiter als die Karte, Text wird abgeschnitten („Fortgeschritte…“); Karten unterschiedlich hoch, Titel umbrechen unsauber.
  - Prozess-Schritte enthalten mehrfach denselben Text: `STEP · 02STEP · 02STEP · 02STEP · 02` (Schritte 2–6), und Schritt 6 zeigt fälschlich „STEP · 05“. Das steckt so in den gespeicherten Inhalten der Seite, nicht im Theme-HTML.
- **Die 4 Domains** (bv-agentur.com, mm-personalvermittlung.de, cac-vermittlung.de, personalservice-gmbh.de) liefern alle die Fehlerseite „Diese Seite ist nicht verfügbar“ (404 vom Landing-Server) — die Seiten kommen also beim Server nicht mehr an. Ursache noch nicht bestätigt (die Produktionsdaten liegen auf eurem eigenen Backend, nicht hier).
- **Doppelte Mails**: Im Code ist die Sperre vorhanden (Vorgangsprotokoll + 20-Stunden-Fenster direkt vor dem Versand). Ob sie auf eurem Backend aktiv ist, hängt am Edge-Function-Deploy — beim letzten Deploy lief nur Portal/DB, das Backend-Deploy nicht durch.

## Plan

### 1. Nebula-Flux Projekt-Karten reparieren
- Meta-Kacheln: Umbruch erlauben und Überlauf verhindern (schmalere Mindestbreite, `min-width:0`, Silbentrennung), Karten auf gleiche Höhe, Button unten bündig.
- Raster auf max. 3 Spalten begrenzen, damit Karten nicht gequetscht werden; mobil sauber einspaltig.
- Schritt-Nummer (`nf-tl-num`) sichtbar als Badge stylen.

### 2. Doppelte Step-Texte entschärfen
- Beim Rendern jeden Slot-Wert normalisieren: identische, direkt wiederholte Textblöcke werden auf eine Ausgabe reduziert (behebt „STEP · 02STEP · 02…“ auch für bereits gespeicherte Seiten, ohne dass ihr neu generieren müsst).
- Zusätzlich beim Generieren: fortlaufende Schrittnummern erzwingen, damit Schritt 6 nicht wieder „05“ zeigt.

### 3. Bewerbungsformular TTS-Beratung
- Statusmeldungen theme-übergreifend sichtbar machen: das Skript setzt die vorhandene Theme-Klasse nicht mehr zurück, sondern ergänzt nur den Zustand (Erfolg/Fehler) — inkl. Styling für die TTS-Beratung-Variante.
- Fehler vom Server konkret anzeigen (statt pauschal „etwas schiefgelaufen“), damit erkennbar ist, ob z. B. Pflichtfelder oder die Domain-Zuordnung das Problem sind.
- Danach eine echte Testbewerbung über die Live-Seite abschicken und im Mail-Center gegenprüfen.

### 4. Doppelversand endgültig absichern
- Prüfen, ob auf dem Backend-Server die aktuelle Version der Mail-Funktionen läuft (Versionskennung der Funktionen abfragen) — die Sperre wirkt nur, wenn sie deployed ist.
- Zusätzliche, nicht umgehbare Sperre auf Datenbankebene: eindeutiger Index auf „gleiche Vorlage + gleicher Empfänger + gleiche Bewerbung“ im Versandprotokoll, plus Sperrvermerk vor dem Versand statt danach.
- Auswertung „mögliche Doppelversendungen“ so anpassen, dass Alt-Fälle (vor der Sperre) und übersprungene Einträge nicht mehr als aktueller Doppelversand gezählt werden.

### 5. Die 4 offline Landing Pages
- Diagnose-Ablauf: Auslieferung der Seiten-Dateien vom Portal an den Landing-Server für genau diese vier Domains prüfen (existiert der Eintrag, ist er veröffentlicht, hängt ein Server dran, liefert die Datei-Schnittstelle Inhalte).
- Je nach Befund: erneute Veröffentlichung anstoßen bzw. die Zuordnung Domain → Server wiederherstellen; falls die Auslieferung stillschweigend leer bleibt, protokollieren wir das künftig sichtbar statt eine 404-Seite zu zeigen.

### Technische Details
- Dateien: `src/landing-themes/theme-nebula-flux/style.css` (Karten/Meta/Timeline), `src/lib/landing-generator.functions.ts` (Slot-Normalisierung, Schrittnummern), `src/landing-themes/_shared/*` bzw. die geteilte Formular-JS in `src/lib/landing-themes.ts` (Statusklassen, Fehlertexte), Mail-Funktionen `supabase/functions/send-application-reminders` / `_shared/dedupe.ts` plus eine Migration für den eindeutigen Index.
- Nach Umsetzung: betroffene Landing Pages neu veröffentlichen, Edge Functions auf das Backend deployen.
