## Ziel

Zwei Dinge: erst den Deploy-Blocker wegräumen, dann das komplette Mail-System durchtesten – Reminder, Registrierung, Bewerbung, Termin – und zwar mit Beleg statt Vermutung.

## 1. Build-Blocker in `src/start.ts`

Der Auth-Guard stoppt jeden Deploy, weil in der Datei wieder zwei Token-Attacher stehen (`attachSupabaseAuth` und `attachSupabaseBearer`). Erlaubt ist nur `attachSupabaseBearer`.

Zu ändern: Import in Zeile 6 entfernen, in Zeile 25 nur noch `attachSupabaseBearer` stehen lassen.

## 2. Bestandsaufnahme: was existiert überhaupt

Bevor irgendwas getestet wird, wird ausgelesen statt geraten:

- Alle Mail-Auslöser im Code sammeln: welche Funktion verschickt welche Vorlage, bei welchem Ereignis.
- Gegenprüfen, welche dieser Auslöser einen aktiven Cron-Job haben und welche nur durch eine Nutzeraktion feuern.
- Ergebnis als eine Tabelle: Anlass → Auslöser (Cron oder Aktion) → Vorlage → Mandant.

So siehst du schwarz auf weiß, ob die „14 Schritte" wirklich alle abgedeckt sind oder ob welche tot im Code liegen.

## 3. Prüfskript `scripts/mail-audit.sh`

Ein neues, rein lesendes Skript für den Portal-Server. Es prüft pro Bereich:

**Cron-Ebene**
- Alle Jobs, Zeitplan, aktiv ja/nein.
- Letzte Läufe je Job mit Status und HTTP-Code.
- Jobs, die seit dem Anlegen noch nie gelaufen sind (die stillen Ausfälle).
- Jobs, deren URL noch Platzhalter enthält.

**Versand-Ebene**
- Versandprotokoll der letzten 7 Tage, gruppiert nach Vorlage und Mandant, mit Erfolg/Fehler.
- Vorlagen, die im Code existieren, aber in 7 Tagen kein einziges Mal versendet wurden – das sind die Verdächtigen.
- Fehlermeldungen im Klartext, nicht nur Zähler.

**Empfänger-Ebene**
- Blockierte Adressen und der Grund.
- Adressen mit mehreren Fehlversuchen in Folge.

**Mandanten-Ebene**
- SMTP-Daten vollständig ja/nein, je Mandant.
- Pausiert ja/nein, mit Grund und Auslöser.
- Letzter erfolgreicher SMTP-Test.

## 4. Live-Test statt nur Protokoll lesen

Protokolle zeigen nur, was passiert ist – nicht, ob es heute noch geht. Deshalb zusätzlich:

- SMTP-Verbindungstest je Mandant mit gültigen Zugangsdaten, Ergebnis wird in `smtp_health_status` geschrieben. Damit ist die Spalte auch endlich befüllt.
- Ein echter Testversand pro aktivem Mandanten an eine Adresse, die du mir nennst.
- Die Reminder-Endpunkte einmal manuell aufrufen und die Antwort ansehen: wie viele Fällige wurden gefunden, wie viele verschickt, wie viele übersprungen und warum.

Der letzte Punkt ist der wichtigste. Ein Cron mit Status „erfolgreich" heißt nur, dass der Aufruf ankam – nicht, dass die Logik jemanden gefunden und angeschrieben hat. Genau da trennt sich „läuft" von „läuft ins Leere".

## 5. Auswertung

Ich liefere dir am Ende eine Liste in drei Töpfen:
- **Grün**: nachweislich verschickt, mit Datum und Empfängerzahl.
- **Gelb**: technisch in Ordnung, aber es gab noch keinen Anlass zum Versenden.
- **Rot**: kaputt oder blockiert, mit konkreter Ursache und Fix.

## Was ich von dir brauche

Eine Test-E-Mail-Adresse für den Live-Versand. Und die Info, ob MuS Marketing und W3 Personal ihre SMTP-Daten inzwischen eingetragen haben – sonst fallen beide automatisch in „Rot" und das verzerrt das Bild.

## Technische Details

- Betroffene Datei für den Blocker: `src/start.ts` (Import Zeile 6, Middleware-Array Zeile 25).
- Neues Skript: `scripts/mail-audit.sh`, ausschließlich lesend, läuft über `supabase_admin` gegen die Backend-Datenbank wie die bestehenden Skripte.
- Der SMTP-Test nutzt die vorhandene `smtp-test`-Funktion, damit `tenant_smtp_health` und `smtp_health_status` mitgeschrieben werden.
- Alle Endpunkt-Aufrufe laufen über die bereits in `.env.server` hinterlegten Zugangsdaten – kein neues Secret nötig.
