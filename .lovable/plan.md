## Problem

**1. Mail-Status ist nicht ablesbar.** Die Liste "Bewerbungen" zeigt pro Bewerber nur **eine einzige** Zeile – nämlich die zuletzt protokollierte Mail. Mal ist das die Bewerbungsmail, mal eine Erinnerung, mal ein technischer Name wie `booking_confirmation`. Man sieht also nie, ob die *anderen* Mails rausgingen. Deshalb wirkt das System kaputt, obwohl es meistens funktioniert.

**2. "Entscheidung offen" darf es nicht geben.** Die KI darf heute `unsure` zurückgeben; dann wird weder Zusage noch Absage ausgelöst und der Bewerber bleibt hängen.

## Lösung

### A. Fester Mail-Status pro Bewerber

Statt einer wechselnden Zeile bekommt **jeder** Bewerber immer dieselbe Kette mit vier Punkten:

```text
Bewerbung ✓   Termin ✓   Erinnerung –   Zusage ⚠
```

- **grün ✓** = Mail nachweislich rausgegangen
- **rot ⚠** = Versand fehlgeschlagen oder blockiert (Tooltip nennt den Grund)
- **grau –** = in diesem Fall gar nicht vorgesehen (z. B. keine Erinnerung nötig, weil Termin gebucht)
- **gelb ⏱** = angestoßen, aber noch kein Ergebnis protokolliert

Damit ist auf einen Blick über alle Zeilen hinweg vergleichbar, wo etwas fehlt – kein Rätselraten mehr.

### B. Klick öffnet die vollständige Mail-Historie

Klick auf die Kette (oder auf den Bewerber) öffnet ein Fenster mit **allen** Mails dieses Bewerbers: Zeitpunkt, Klarname der Vorlage (keine technischen Namen), Status, Fehlergrund, plus Button "Erneut senden". Datenquelle sind die bereits vorhandenen Tabellen `email_send_log` und `application_reminder_log`, zusammengeführt und nach Zeit sortiert.

### C. Klarnamen statt Technik

Eine zentrale Übersetzungstabelle ersetzt `booking_confirmation`, `interview_invite_30min` usw. überall durch deutsche Bezeichnungen. Wird in Liste, Historie und Mail-Center gleichermaßen benutzt.

### D. Bewerber-Status: keine offene Entscheidung mehr

- Die KI-Auswertung liefert künftig nur noch **Zusage** oder **Absage**. Der Prompt wird auf eine bewusst niedrige Ablehnungsschwelle gestellt: Absage nur bei klarer Ablehnung der Mitarbeit, patzigen/respektlosen Antworten oder komplett unbrauchbaren Angaben. In allen anderen Fällen Zusage.
- Ein zurückgegebenes `unsure` wird serverseitig zur **Zusage** aufgelöst (mit Vermerk im Protokoll, damit es nachvollziehbar bleibt).
- Wenn die Auswertung technisch unlesbar ist (kein gültiges JSON), gilt es **nicht** als Zusage – dann wird ein klar erkennbarer Status "Auswertung fehlgeschlagen · erneut auswerten" mit Wiederholungs-Button angezeigt. Das ist ein technischer Fehler, keine Bewertung.
- Die Phase "Entscheidung offen" fällt damit aus der normalen Liste weg.

## Technische Umsetzung

- Neue Server-Function `getApplicationMailStatus` (Batch für die Liste) liest `email_send_log` + `application_reminder_log`, mappt sie auf die vier festen Kettenpunkte und liefert je Punkt Status + Zeit + Grund.
- Neue Komponente `MailChain` (Liste) und `MailHistoryDialog` (Detail) unter `src/components/mail/`.
- `src/routes/admin.bewerbungen.tsx`: bisherige Einzel-Badge-Logik (Zeilen ~542–602) durch `MailChain` ersetzen; Phase `entscheidung_offen` in `computePhase` durch die neuen Regeln ersetzen.
- `src/lib/interview-engine.server.ts`: Entscheidungs-Prompt schärfen, `unsure` → `invite` auflösen, Parse-Fehler als eigener Zustand `auswertung_fehlgeschlagen` statt `unsure`.
- Template-Klarnamen in `src/lib/email-stats.ts` erweitern und als gemeinsame Quelle nutzen.
- Kein Schema-Wechsel nötig, wenn `interview_recommendation` weiterhin nur `invite`/`reject` speichert; der Fehlerfall wird über `ai_decision = 'error'` abgebildet.

## Deploy danach

```bash
cd /opt/apps/portal && git reset --hard HEAD && git pull && bash scripts/deploy.sh
```
