## Was du geändert haben willst

1. **Es darf nie „Auswertung fehlgeschlagen" geben.** Wenn das Gespräch geführt wurde, fällt immer eine Entscheidung: Zusage oder Absage.
2. **Grau sagt zu wenig.** Statt „nicht vorgesehen" willst du sehen, *was als Nächstes passiert* — z. B. „Erinnerung geht am 30.07. um 12:06 raus, weil kein Termin gebucht ist".

## Lösung

### A. Entscheidung ist garantiert

- Die KI-Auswertung wird bis zu **3-mal** wiederholt, wenn die Antwort technisch unlesbar ist (kein gültiges JSON). Zwischen den Versuchen wird das Modell strenger angewiesen: nur reines JSON.
- Bleibt es unlesbar, greift eine **regelbasierte Notauswertung** aus dem Gesprächsverlauf: Hat der Bewerber inhaltlich geantwortet und Interesse gezeigt → **Zusage**. Hat er abgebrochen, abgelehnt oder nur unbrauchbare Antworten gegeben → **Absage**.
- Ergebnis: Nach jedem beendeten Interview steht `Zusage` oder `Absage`. Der Zustand „Auswertung fehlgeschlagen" entfällt komplett aus Datenmodell und Oberfläche. Im Protokoll wird vermerkt, ob die Entscheidung von der KI oder aus der Notregel kam — nachvollziehbar bleibt es trotzdem.

### B. Statt „grau" → der nächste Schritt

Die Mail-Kette bekommt einen fünften, sprechenden Teil: **„Nächster Schritt"**. Jeder Bewerber zeigt genau einen Satz, z. B.:

```text
Bewerbung ✓   Termin –   Erinnerung ⏱   Zusage –
Nächster Schritt: Erinnerung „Kein Termin" am 30.07., 12:06
```

Weitere Beispiele:
- „Wartet auf Terminbuchung · Erinnerung am 30.07., 12:06 (24 h), dann 01.08., 12:06 (72 h)"
- „Termin am 31.07., 14:00 · Erinnerung 30 Min vorher"
- „Zusage erteilt · Registrierung offen · Erinnerung am 01.08., 09:12"
- „Nicht erschienen · Nachfass am 01.08., 14:00"
- „Registriert · keine weitere E-Mail geplant" (echter Endzustand, klar benannt)

Und ein grauer Punkt trägt künftig immer einen Tooltip mit Begründung: „Keine Erinnerung nötig — Termin ist gebucht" statt nur „–".

**Woher die Zeiten kommen:** die Fristen stehen fest im Reminder-Dienst und werden im Frontend gespiegelt (24 h / 72 h nach Bewerbung ohne Termin; 24 h nach verpasstem Termin; 24 h / 72 h nach Zusage ohne Registrierung; 24 h / 72 h nach Absage eines Termins; 30 Min vor dem Interview). Angezeigt wird jeweils der nächste noch nicht versendete Punkt, auf Basis von Bewerbungsdatum, Terminzeit und dem, was laut Log schon raus ist. Der Cron läuft alle 30 Min, deshalb steht bei der Zeit „ca.".

## Technische Umsetzung

- `src/lib/interview-engine.server.ts`: Retry-Schleife (3 Versuche) um die JSON-Auswertung, danach regelbasierter Fallback; Typ `Recommendation` wieder auf `"invite" | "reject"` reduzieren.
- `src/routes/api/public/interview-chat.ts`: `error`-Zweig entfernen, `interview_recommendation` ist immer gesetzt, `ai_decision` immer `zusage`/`absage`; Herkunft der Entscheidung in `ai_reason` bzw. `automation_log` vermerken.
- Neue Datei `src/lib/mail-next-step.ts`: berechnet aus Bewerbung (created_at, scheduled_at, booking_status, Invite-Token-Alter, bereits gesendete Reminder) den nächsten geplanten Versand inkl. Zeitpunkt und Klartext. Fristen als Konstanten, identisch zu `supabase/functions/send-application-reminders/index.ts`.
- `src/lib/mail-chain.ts`: `na`-Zustand bekommt einen Begründungstext statt nur „nicht vorgesehen".
- `src/components/mail/MailChain.tsx` + `src/routes/admin.bewerbungen.tsx`: Zeile „Nächster Schritt: …" unter der Kette; im Historien-Dialog zusätzlich ein Block „Geplante E-Mails" mit allen kommenden Punkten.
- `src/routes/admin.personen.$id.tsx`: Reste von „unsure"/„Auswertung fehlgeschlagen" entfernen.
- Kein Schema-Wechsel nötig.

## Deploy danach

```bash
cd /opt/apps/portal && git reset --hard HEAD && git pull && bash scripts/deploy.sh
```
