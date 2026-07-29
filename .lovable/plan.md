## Was ich geprüft habe

Ich habe alle 14 Mail-Funktionen durchgesehen (Bewerbungs-Reminder, Termin-Erinnerung, Terminbestätigung, Chat-Reminder, Onboarding-Reminder, Einladungen, Passwort-Reset, Registrierungs-Bestätigung, Resend, Warteschlange) samt der gemeinsamen Bausteine (Sendefenster, Kontingente, Absender-Auflösung, Protokollierung).

## Befunde

### 1. Dieselbe Doppelversand-Ursache steckt noch in zwei weiteren Jobs (bestätigt)

Die 111 Mails an einen Bewerber kamen daher, dass die Prüfung „habe ich das schon geschickt?" nur die ersten 1.000 Protokollzeilen laden konnte. Genau dieses Muster steckt unverändert noch in:

- **Terminbestätigung** (`send-booking-confirmation`): lädt zur Prüfung *alle* jemals versendeten Terminbestätigungen — ungefiltert und ohne Seitenlogik. Sobald es mehr als 1.000 davon gibt, fallen ältere Termine aus dem Ergebnis und die Bestätigung geht erneut raus. Dasselbe gilt für die Fehler-Zählung („max. 3 Versuche"), die dadurch ebenfalls unwirksam wird.
- **Termin-Erinnerung 30 Min vorher** (`send-appointment-reminders`): gleiche Prüfung ohne Seitenlogik — kippt, sobald das Protokoll eines Zeitfensters über 1.000 Zeilen kommt.

Das erklärt auch die doppelte „Terminbestätigung" im Screenshot von vorhin.

### 2. Kontingent-Zähler zählen nur bis 1.000

Der Onboarding-Reminder-Motor (`send-reminders`) ermittelt die Stunden-/Tagesmengen pro Firma, indem er die Protokollzeilen lädt und zählt — ebenfalls bei 1.000 gekappt. Bei viel Verkehr werden die SMTP-Grenzen dadurch zu niedrig gerechnet und Grenzen zu spät gezogen.

### 3. Altlasten in der Datenbank

Die bereits versendeten Duplikate (u. a. 111 Zeilen für einen Bewerber) stehen weiter in Protokoll und Mail Center und verfälschen alle Statistiken.

### 4. Kein gemeinsamer Schutz

Jede Funktion baut ihre Doppelsende-Prüfung selbst. Genau deshalb ist derselbe Fehler dreimal entstanden.

## Was ich umsetzen will

1. **Zentrale Doppelsende-Sperre** als gemeinsamer Baustein für alle Mail-Funktionen: „diese Vorlage an diese Adresse" geht nur einmal raus, plus harte Zeitsperre (dieselbe Vorlage nie zweimal innerhalb von 20 Stunden an dieselbe Adresse). Wird direkt vor dem Versand geprüft, unabhängig davon, ob vorher etwas schiefging.
2. **Terminbestätigung und Termin-Erinnerung** auf diese Sperre umstellen und ihre Prüf-Abfragen auf den jeweiligen Vorgang eingrenzen statt „alles laden" — damit ist die 1.000-Zeilen-Falle strukturell weg.
3. **Kontingent-Zähler** auf echte Datenbank-Zählung umstellen (statt Zeilen laden und abzählen), damit die SMTP-Grenzen wieder stimmen.
4. **Aufräum-Skript** (`scripts/cleanup-duplicate-mails.sh`): zeigt erst alle betroffenen Empfänger und Duplikat-Zahlen an, entfernt auf Bestätigung die überzähligen Protokollzeilen (je Vorgang bleibt die erste erhalten). Nichts wird ohne Anzeige gelöscht.
5. **Wächter im Mail Center**: ein Hinweisbanner „X Doppelversände in den letzten 24 h" mit Klick auf die Liste — falls so etwas je wieder auftritt, siehst du es sofort statt erst nach 111 Mails.
6. **Prüf-Skript erweitern** (`scripts/mail-audit.sh`): meldet künftig auch Doppelversände und Vorgänge ohne Versandprotokoll („Hänger").

## Technischer Teil

- Neu: `supabase/functions/_shared/dedupe.ts` mit `alreadySent(admin, {applicationId, kind, recipient, templateName, windowHours})` — nutzt `count: "exact", head: true` statt Zeilen zu laden.
- `send-booking-confirmation`: Dedup-/Fail-Cap-Abfragen auf `metadata->>appointment_id` der aktuellen Kandidaten eingrenzen + zentrale Sperre.
- `send-appointment-reminders`: Reminder-Log-Abfrage seitenweise (`.range()`) + zentrale Sperre.
- `send-reminders`: 24h/1h-Zähler auf `count: "exact", head: true` pro Tenant.
- Kein Datenbank-Schema-Eingriff; das Aufräumen läuft über ein Skript mit Vorschau und Backup-Hinweis.

## Rückfragen

- Beim Aufräumen: sollen die überzähligen Zeilen **gelöscht** oder nur als „Duplikat" markiert werden (Statistiken sauber, Historie bleibt nachvollziehbar)? Ich würde Markieren empfehlen.
- 20-Stunden-Sperrfrist für gleiche Vorlage + gleiche Adresse — passt das für alle Fälle, oder gibt es eine Mail, die bewusst öfter am Tag rausgehen darf?
