## Warum mus-marketing.de „verbuggt" aussieht — Ursache gefunden

Esb

Der Renderer ersetzt Inhalte über Platzhalter der Form `{{hero_title}}`, `{{brand_name}}`, `{{impressum_url}}` usw. Die beiden neuesten Vorlagen sind aber anders gebaut:


| Theme               | Platzhalter `{{...}}` im Template | Folge                                 |
| ------------------- | --------------------------------- | ------------------------------------- |
| Nebula Flux         | **0**                             | keine deiner Eingaben wird übernommen |
| Quantum Tech        | **0**                             | dito                                  |
| alle älteren Themes | 14–143                            | funktionieren korrekt                 |


Beide nutzen stattdessen `data-editable="hero_title"` — ein Attribut, das **im gesamten Portal von nichts ausgewertet wird**. Ergebnis auf der Live-Seite:

- Es steht überall der Demo-Text der Vorlage: „NEBULA — Digital Quality Platform", „Qualität sichtbar machen", 25.000 Tests, 3.000+ Tester, erfundene Kundenstimmen (Lena Meier, Timo Schulz, Anna Kraus) statt MuS-Marketing-Inhalten.
- Footer-Mail/Telefon bleiben leer bzw. auf Demo-Werten.
- `og:title` / `og:description` werden leer ausgeliefert (schlechtes SEO / Link-Vorschau).

Zusätzlich, unabhängig davon:

- **Impressum, Datenschutz, AGB, Cookies im Footer zeigen auf `href="#"**` — die Rechtstexte sind live nicht erreichbar (rechtlich kritisch). Betroffen: Nebula Flux, Quantum Tech, Device Stack, Talent Hub. Die Rechts-Unterseiten existieren (`/impressum` liefert 200), sind aber nicht verlinkt.
- Auch „Über uns / Karriere / Kontakt / Presse" und die Social-Icons sind tote `#`-Links.

## Was ich machen will

### 1. Themes auf das echte Platzhalter-System umstellen

- In `theme-nebula-flux` und `theme-quantum-tech` jeden `data-editable="key"`-Block auf den echten Platzhalter `{{key}}` umbauen (Text-Slots, Attribut-Slots wie `content|seo_title`, `accent_color`).
- `meta.json` beider Themes so erweitern, dass alle sichtbaren Inhalte editierbar sind — bei Nebula heute nur 19 Slots bei ~426 Zeilen Inhalt. Neu abgedeckt: Leistungs-Kacheln, Prozess-Schritte, Kennzahlen, Kundenstimmen, Footer-Spalten.
- Sinnvolle Defaults behalten, damit bestehende Seiten nicht leer werden.

### 2. Rechts-Links reparieren (alle 4 betroffenen Themes)

- Footer-Links auf `{{impressum_url}}` / `{{datenschutz_url}}` setzen (der Renderer füllt diese automatisch mit `impressum.html` / `datenschutz.html`).
- Tote `#`-Links (Über uns, Karriere, Presse, Social) entweder mit Slots belegen oder entfernen, statt ins Leere zu zeigen.

### 3. Absicherung, damit das nicht wieder passiert

- Prüfskript `scripts/check-themes.sh`: meldet je Theme, ob (a) Platzhalter fehlen, (b) `data-editable` ohne `{{}}` benutzt wird, (c) Impressum/Datenschutz verlinkt sind, (d) meta.json-Slots und Template-Platzhalter zueinander passen.

### 4. Danach: Seite neu ausspielen

- Auf dem Landing-Server Cache flushen (`/_internal/flush`), MuS Marketing neu veröffentlichen und die Slots im Landing-Generator mit echten Firmendaten befüllen.

## Zu deinen zwei Fragen

**„Was sind Crons genau? Wir haben doch 14 E-Mails."**
Ein Cron ist nur ein **Zeitschalter** — kein E-Mail-Typ. Es gibt zwei Sorten Mails:

- **Ereignis-Mails** (Bewerbung eingegangen, Terminbestätigung, Zusage …) — die gehen sofort raus, wenn etwas passiert. Dafür braucht es gar keinen Cron.
- **Zeit-Mails / Reminder** (kein Termin gebucht nach 24 h, Termin verpasst, Registrierung nicht abgeschlossen …) — die kann nur eine Uhr auslösen. Genau das sind die 9 Crons: ein Cron ruft eine Funktion auf, und **eine** Funktion verschickt je nach Lage mehrere verschiedene Mail-Typen. Deshalb 9 Uhren für 17–23 Mail-Typen.

**„Läuft das Mail-System wirklich überall?"** — Noch nicht vollständig. Aus dem letzten Report bleiben offen, und das prüfe ich im selben Zug:

- `application_received`: 0 gesendet / 26 fehlgeschlagen — Fehlerursache aus den Logs holen und beheben.
- `booking_confirmation`: 125 gesendet / 224 fehlgeschlagen — dito.
- LH Marketing: SMTP-Passwort falsch (Fehler 535) → muss von dir neu hinterlegt werden.
- MuS Marketing + W3 Personal: kein SMTP hinterlegt → von dir eintragen.
- UWK Consulting: noch pausiert → nach SMTP-Fix entpausen.

Ich baue dafür `scripts/diagnose-mail-failures.sh`, das die konkreten Fehlermeldungen der 26 bzw. 224 Fehlversuche gruppiert ausgibt — damit sehen wir, ob es SMTP-Daten sind oder ein echter Code-Fehler.

## Technische Details

- Betroffen: `src/landing-themes/theme-nebula-flux/{template.html,meta.json}`, `src/landing-themes/theme-quantum-tech/{template.html,meta.json}`, Footer in `theme-device-stack` und `theme-talent-hub`.
- Ersetzung erfolgt durch `applyPlaceholders()` in `landing-server/server.js` (Zeile ~325 ff.), die ausschließlich `{{key}}` kennt; `data-editable` wird nirgends im Portal gelesen.
- Rechts-Slots werden serverseitig hart auf `impressum.html` / `datenschutz.html` gesetzt — im Template genügt daher der Platzhalter.
- Neue Skripte: `scripts/check-themes.sh`, `scripts/diagnose-mail-failures.sh` (beide nur lesend).