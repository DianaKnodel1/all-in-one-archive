## Gegenprüfung — Ergebnis

Ich habe alle in der letzten Runde geänderten Stellen erneut gelesen. **Drei Sachen sind sauber**, **vier Punkte solltest du vor dem Deploy noch mitnehmen**.

### Sauber (geprüft, nichts zu tun)
- `send-reminders`: Kontingent-Zähler laufen jetzt serverseitig (`count: "exact", head: true`), 1.000-Zeilen-Falle weg, Doppelzählung durch `Math.max` statt Summe korrekt.
- `send-appointment-reminders`: „schon gesendet"-Prüfung lädt seitenweise (`.range`) — gekappt kann sie nicht mehr werden.
- `send-application-reminders`: harte Doppelsperre direkt vor dem Versand vorhanden (einmal pro Bewerber+Art, plus 20-h-Fenster pro Adresse+Vorlage).

### Noch offen

**1. Kontingent-Zähler in `send-application-reminders` ist weiterhin gekappt**
Zeile ~594–606 lädt für die 1-h-/12-h-Rechnung noch Zeilen (`select tenant_id, created_at`) statt serverseitig zu zählen. Ab 1.000 Zeilen im Fenster rechnet der Job das Kontingent zu niedrig und zieht die SMTP-Grenze zu spät. Gleiche Umstellung wie in `send-reminders`: pro Tenant zwei `count`-Abfragen (1 h / 12 h).

**2. `send-booking-confirmation` macht bis zu 400 Einzelabfragen pro Lauf**
Die neue Prüfung läuft in einer Schleife über bis zu 200 Termine × 2 Abfragen — sequenziell. Das ist bei vollem Fenster zu langsam (Timeout-Risiko alle 30 Min). Fix: **eine** Abfrage für alle Termin-IDs gleichzeitig (`.in("metadata->>appointment_id", apptIds)` für `sent` und für `failed`), Ergebnis in zwei Sets/Zähler auflösen — statt Schleife.

**3. Der Status `duplicate` aus dem Aufräum-Skript wird nirgends verstanden**
Das Skript markiert überzählige Zeilen mit `status = 'duplicate'`. Im Mail Center wird nur `superseded` ausgefiltert; `duplicate` landet damit als **„noch kein Ergebnis"** in Liste und Statistik und auch in der Bewerber-Historie. Nach dem Aufräumen sähe es also so aus, als hingen 111 Mails. Fix:
- Mail Center: `duplicate` genauso wie `superseded` aus Liste, Zähler und Tagesbalken ausblenden (bzw. eigene graue Kachel „Doppelversand bereinigt").
- `src/lib/mail-chain.ts`: `duplicate` in `normalize()`/`statusStyle()` als eigener grauer Zustand „Doppelversand (bereinigt)", nicht als „pending".

**4. Aufräum-Skript: Gruppierung ist etwas zu grob**
Partitioniert wird nach *Vorlage + Empfänger + Kalendertag*. Wenn dieselbe Vorlage an einem Tag legitim zweimal an dieselbe Adresse geht (z. B. Terminbestätigung nach Umbuchung), würde die zweite fälschlich als Duplikat markiert. Vorschlag: zusätzlich nach `metadata->>'appointment_id'` bzw. `metadata->>'application_id'` gruppieren, wo vorhanden — dann trifft es nur echte Wiederholungen desselben Vorgangs. Die Sicherungstabelle bleibt, das Skript verändert weiterhin nichts ohne `--apply`.

### Reihenfolge beim Ausrollen (nach den Fixes)
1. Backend-Server: `git pull && bash scripts/deploy-backend-local.sh`
2. `bash scripts/cleanup-duplicate-mails.sh --local` (nur ansehen) → dann `--apply`
3. Portal-Server: `git reset --hard HEAD && git pull && bash scripts/deploy.sh`

Wichtig: erst die Mail-Jobs (Backend), dann aufräumen, dann das Portal — sonst produziert der alte Cron während des Aufräumens neue Duplikate.

### Technische Details
- Betroffene Dateien: `supabase/functions/send-application-reminders/index.ts`, `supabase/functions/send-booking-confirmation/index.ts`, `src/routes/admin.email-center.tsx`, `src/lib/mail-chain.ts`, `scripts/cleanup-duplicate-mails.sh`.
- Keine DB-Migration nötig; `email_send_log.status` hat keinen Check-Constraint, `duplicate` ist als Wert zulässig.
