## Befund der Prüfung

Ich habe alle 21 Themes, den ZIP-Generator, den Live-Renderer und die Theme-Defaults durchgesehen. Die Impressen sind nicht "kaputt", aber an vier Stellen wirken sie unprofessionell:

**1. Drei unterschiedliche Impressum-Versionen im Umlauf**
- `src/lib/landing-generator.functions.ts` (ZIP-Download) — 7 Datenschutz-Abschnitte + § 18 MStV
- `landing-server/server.ts` (Live-Seiten) — nur 4 Datenschutz-Abschnitte, **kein** § 18 MStV
- `landing-server/server.js` (die tatsächlich laufende Datei) — eigene Kopie derselben Logik

Ergebnis: Die live ausgelieferte Seite hat ein dünneres Impressum als das ZIP. Was der Kunde im Generator sieht, ist nicht das, was online steht.

**2. Die Rechtsseiten sehen aus wie ungestylte Rohtexte**
`buildLegalPage()` erzeugt eine weiße Seite mit `system-ui`, ohne Logo, ohne Markenfarbe, ohne die Navigation/Footer des Themes. Für ein Theme wie „Midnight Premium" oder „Editorial Premium" ist der Bruch drastisch — genau das wirkt unseriös. Zusätzlich wird per `html, body { background:#fff !important }` das Theme-CSS überschrieben.

**3. Inhaltlich unvollständig für ein deutsches Impressum**
Es fehlen durchgehend: Haftungsausschluss für Inhalte (§ 7 DDG) und Links, Urheberrechtshinweis, EU-Streitschlichtung/ODR-Hinweis + VSBG-Erklärung, Aufsichtsbehörde/AÜG-Erlaubnis (bei Personalvermittlung relevant), Verantwortlicher nach § 18 Abs. 2 MStV (live fehlt er ganz). Die § 18-Zeile steht im ZIP zudem in 70 % Opazität — sieht nach Kleingedrucktem aus.

**4. Musterdaten und Werbe-Badges**
- Theme-Defaults enthalten `Musterstraße 1 / 12345 Musterstadt`, `+49 (0) 123 456 789`, `+49 30 12345678`, `hallo@example.com`, `example.com` (u. a. TTS-Consultant, Tester-Lab, QA-Grid, Job-Gleiter, Mirror-Site, Quantum-Tech, Nebula-Flux, Editorial/Midnight/QA-Platform-Premium). Werden Footer-Slots nicht überschrieben, stehen Fantasie-Adressen auf der Live-Seite — der schlimmste Seriositätskiller.
- Der injizierte Trust-Footer hängt grüne Badges „SSL-verschlüsselt" / „DSGVO-konform" neben die Anbieterkennzeichnung. Das wirkt werblich statt sachlich.

## Umsetzungsplan

**A. Eine gemeinsame Quelle für Rechtstexte**
Neues Modul `src/lib/legal-content.ts` mit `renderImpressum()`, `renderDatenschutz()` und `buildLegalPage()`. ZIP-Generator importiert es direkt; `landing-server/server.ts`/`server.js` bekommen die identischen Texte gespiegelt (der Landing-Server läuft eigenständig auf dem VPS und kann nicht aus `src/` importieren) — mit Versionsmarker im Kommentar, damit Abweichungen auffallen.

**B. Impressum inhaltlich vervollständigen**
Struktur nach Standard: Angaben gemäß § 5 DDG → Vertretungsberechtigte → Kontakt → Registereintrag → Umsatzsteuer-ID → Aufsichtsbehörde/Erlaubnis (nur wenn gepflegt) → Redaktionell verantwortlich (§ 18 Abs. 2 MStV, in normaler Schriftgröße) → Freitext des Kunden → Haftung für Inhalte → Haftung für Links → Urheberrecht → EU-Streitschlichtung + VSBG-Hinweis. Leere Felder erzeugen keine leeren Überschriften.

**C. Datenschutz auf einen Stand bringen**
Live-Version bekommt dieselben 7 Abschnitte wie das ZIP, ergänzt um Hosting/Server-Logfiles und Cookies/Tracking-Hinweis; identisch in beiden Pfaden.

**D. Rechtsseiten im Theme-Design**
`buildLegalPage()` erhält: Kopfzeile mit Logo (falls hochgeladen) bzw. Firmenname und Primärfarbe, dezente Typo-Skala, ruhiges Zwei-Spalten-Layout auf Desktop, echter Footer mit Kontakt + Impressum/Datenschutz. Primär-/Sekundärfarbe werden aus dem Branding als CSS-Variablen gesetzt, das `!important`-Überschreiben des Theme-CSS entfällt. Ziel: erkennbar dieselbe Marke wie die Landing Page, aber nüchtern und textlastig.

**E. Musterdaten entschärfen**
Alle Platzhalter-Adressen/Telefonnummern/E-Mails in den `meta.json`-Defaults auf leere Strings umstellen bzw. als `placeholder` statt `default` behandeln, sodass sie im Editor als Hinweis sichtbar, aber nicht in die generierte Seite übernommen werden. Zusätzlich im Generator eine Warnung, wenn Firmenname, Straße, PLZ/Ort oder E-Mail fehlen, bevor eine Seite veröffentlicht wird.

**F. Footer versachlichen**
Die Badges „SSL-verschlüsselt" / „DSGVO-konform" aus `injectTrustFooter` entfernen (bzw. durch eine schlichte Textzeile ersetzen). Anbieterkennzeichnung in lesbarer Größe statt 90 % Opazität, Links ohne Unterstreichungs-Hack.

**G. Verifikation**
Für 4 repräsentative Themes (Midnight Premium, Editorial Premium, Tester-Lab, TTS-Consultant) ZIP-Ausgabe erzeugen, `impressum.html`/`datenschutz.html` im Browser rendern und per Screenshot prüfen; zusätzlich Kontrolle, dass kein Theme noch „Musterstraße"/„example.com" ausliefert.

### Technische Hinweise
- Der Landing-Server ist eine eigene Node-/Bun-App (`landing-server/server.js` ist die produktiv laufende Datei, `server.ts` die Quelle) — nach dem Deploy muss diese Datei mit ausgerollt werden, sonst bleiben Live-Seiten auf den alten Texten.
- Bestehende, bereits in der DB gespeicherte Landings sind nicht betroffen, weil Impressum/Datenschutz zur Laufzeit aus `branding` gerendert werden — die Verbesserung greift sofort nach dem Deploy.
- Kein Eingriff in Formular-, Funnel- oder E-Mail-Logik.

### Rechtlicher Hinweis
Die Texte sind sorgfältige Standardformulierungen, ersetzen aber keine Rechtsberatung. Insbesondere Aufsichtsbehörde/AÜG-Erlaubnis muss pro Mandant korrekt gepflegt werden.
