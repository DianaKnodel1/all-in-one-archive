## Was verbessert wird

Zwei Dinge in der E-Mail-Historie eines Bewerbers.

### 1. Technische Wörter durch Klartext ersetzen

Heute steht in der Historie z. B. `duplicate_application` in Rot – das sieht nach Fehler aus, ist aber keiner. Der Fall aus Screenshot 2: Nathalie Favara hat das Bewerbungsformular **zweimal** abgeschickt. Beim ersten Mal ging „Bewerbung eingegangen" raus (✓ gesendet), beim zweiten Mal hat das System erkannt „gleiche Person, Mail ist schon draußen" und keine zweite geschickt. Genau richtig – nur schlecht erklärt.

Künftig steht dort:
- `duplicate_application` → „Doppelte Bewerbung – Mail war bereits verschickt"
- `tenant_paused` → „Mandant pausiert – Versand gestoppt"
- `smtp_incomplete` → „Keine SMTP-Zugangsdaten hinterlegt"
- `no_domain` → „Keine Domain für den Link hinterlegt"
- `recipient_suppressed` → „Empfänger gesperrt (Bounce/Abmeldung)"
- `duplicate_recipient` → „Gleiche Mail ging vor Kurzem schon raus"
- usw. für alle vorkommenden Gründe

Zusätzlich wird eine „übersprungen"-Zeile, die nur ein Duplikat ist, dezent grau statt rot dargestellt – kein Alarm-Look für einen Normalfall.

### 2. Beim „Nächster Schritt" ein Knopf „Jetzt senden"

Neben der Zeile „Nächster Schritt: Erinnerung · Interview in 30 Minuten am 30.07., 09:30 Uhr" kommt ein Knopf **„Jetzt senden"**. Damit geht die Erinnerung sofort raus, statt auf den automatischen Zeitpunkt zu warten – z. B. wenn du einen Bewerber vorab anstupsen willst.

Sicherheitsnetz: vor dem Senden erscheint eine Rückfrage („Wirklich jetzt senden? Automatisch würde sie um 09:00 rausgehen."). Wird sie manuell verschickt, greift die bestehende Doppelversand-Sperre, d. h. die automatische Erinnerung geht danach **nicht** zusätzlich raus.

Wenn gerade kein Schritt ansteht (z. B. Termin schon vorbei), gibt es keinen Knopf.

### Was nicht gemacht wird
- Kein Verschieben/Abschalten einzelner Schritte pro Bewerber – das würde einen neuen Planungs-Datensatz brauchen und die Automatik unübersichtlich machen.
- Keine Massenaktion über hunderte Bewerber gleichzeitig – Risiko von Massen-Fehlversand und SMTP-Sperren zu hoch. Falls du das brauchst, bauen wir es separat mit Vorschau + Limit.

## Technische Details

- `src/lib/mail-chain.ts`: zentrale Übersetzungstabelle `reasonLabel(reason)` (technischer Code → deutscher Text), Rückgabe zusätzlich zum Rohwert, damit Tooltips beides zeigen können.
- `src/components/mail/MailChain.tsx`: Rohgrund durch das Label ersetzen; Duplikat-/Erwartet-Gründe neutral (muted) statt destructive stylen; „Jetzt senden"-Button an der Nächster-Schritt-Zeile inkl. Bestätigungsdialog (analog zum vorhandenen Resend-Dialog).
- `src/lib/mail-next-step.ts`: neben Text/Zeitpunkt auch die auslösbare Kennung (`kind`, z. B. `interview_invite_30min`) zurückgeben, damit der Button weiß, was er auslösen soll.
- Auslösen serverseitig über die bestehende Resend-/Invoke-Route mit `application_id` + `kind`; dabei `application_reminder_log` als „sent" schreiben, sodass der Cron denselben Reminder nicht erneut verschickt.
- Nur Frontend + eine bestehende Serverroute – keine DB-Migration, kein Edge-Function-Deploy nötig (Portal-Deploy reicht).
