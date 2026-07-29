## Penible Gegenprüfung — Ergebnis

Ich habe die vier Änderungen nochmal gelesen und dabei den Weg jeder Zeile bis in die Oberfläche verfolgt. **Zwei Änderungen sind sauber**, **fünf Punkte würden nach dem Deploy Probleme machen** — vier davon hängen alle am neuen Status `duplicate`.

### Sauber
- `send-application-reminders`: Kontingente werden serverseitig gezählt, keine Kappung mehr. Anzahl Tenants ist klein, die Schleife ist unkritisch.
- `send-booking-confirmation`: statt 400 Einzelabfragen jetzt zwei Sammelabfragen. Die exakte Endprüfung direkt vor dem Versand bleibt bestehen — selbst wenn die Vorauswahl etwas übersieht, kann daraus **kein** Doppelversand entstehen.

### Muss vor dem Deploy noch rein

**1. Nach dem Aufräumen würden grüne Haken grau werden**
`buildMailChain` nimmt pro Schritt das **neueste** Ereignis. Das Aufräum-Skript behält die *älteste* Zeile als `sent` und markiert die *späteren* als `duplicate` — also ist die neueste Zeile ausgerechnet eine bereinigte. Ergebnis: bei Bewerbern mit bereinigten Duplikaten zeigt die Kette „⧉ Doppelversand" statt „✓ gesendet". Fix: bei der Auswahl des Schritt-Ereignisses `duplicate`-Zeilen überspringen, solange es ein echtes Ereignis gibt.

**2. Statistik im Verlaufs-Dialog zählt Duplikate als „ohne Ergebnis"**
In `MailChain.tsx` fallen `duplicate`-Einträge in den Sammeltopf `other` („⏱ ohne Ergebnis"). Fix: eigene Zeile „⧉ n bereinigt" oder aus der Zusammenfassung herausrechnen.

**3. Dashboard-Statistik behandelt `duplicate` als „pending"**
`src/lib/email-stats.ts` filtert nur `superseded` heraus und kennt `duplicate` weder in `STATUS_PRIORITY` noch in `FINAL_STATUSES`. Damit landen bereinigte Zeilen in `computeEmailStats` als **pending** — inklusive „hängt seit > 6 h" — und verfälschen Admin-Startseite und E-Mail-Logs. Fix: `duplicate` wie `superseded` herausfiltern und als finalen Zustand mit niedriger Priorität eintragen.

**4. Seite „E-Mail-Logs" blendet `duplicate` nicht aus**
`admin.email-logs.tsx` filtert nur `.neq("status","superseded")`. Gleiche Umstellung wie im Mail Center: beide Status ausblenden. Zusätzlich `EMAIL_STATUS_LABELS`/`-COLORS` um `duplicate` („Doppelversand bereinigt", grau) ergänzen, damit nirgends der technische Rohwert auftaucht.

**5. Bewerber-Historie lädt die 5.000 neuesten Mails ohne Filter**
`admin.bewerbungen.tsx` holt `email_send_log` ungefiltert mit `limit(5000)`. Genau die 111 Duplikat-Zeilen verdrängen dort ältere echte Mails anderer Bewerber aus dem Fenster — die Kette zeigt dann fälschlich „noch kein Ergebnis". Fix: dieselbe Ausblendung (`superseded`, `duplicate`) auch in dieser Abfrage. Nach dem Aufräumen entspannt sich das zusätzlich von selbst.

### Rest-Risiken (bewusst akzeptiert, kein Code-Fix)
- Die neue Sammelabfrage nach Termin-Kennung liefert selbst maximal 1.000 Zeilen. Das betrifft nur die *Vorauswahl* — die exakte Endprüfung pro Termin läuft weiterhin serverseitig als Zählung, ein Doppelversand kann daraus nicht entstehen. Höchstens der Zähler „übersprungen, schon gesendet" in der Job-Antwort ist minimal zu niedrig.
- Beim Probelauf (`dry_run`) greift die Endprüfung nicht, weil vorher abgebrochen wird. Der Probelauf kann also etwas mehr „würde senden" melden als der Echtlauf tatsächlich verschickt. Für einen Testlauf unkritisch.

### Technische Details
- Zu ändern: `src/lib/mail-chain.ts`, `src/components/mail/MailChain.tsx`, `src/lib/email-stats.ts`, `src/routes/admin.email-logs.tsx`, `src/routes/admin.bewerbungen.tsx`.
- Reine Anzeige-/Filterlogik, keine Datenbank-Migration, keine Änderung am Versand selbst.
- Deploy-Reihenfolge bleibt: erst Backend (Mail-Jobs), dann `cleanup-duplicate-mails.sh` (erst ohne, dann mit `--apply`), zuletzt Portal.
