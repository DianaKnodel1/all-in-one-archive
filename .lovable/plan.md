Ja — die Interview-KI wurde bereits überarbeitet: menschlichere Lese-/Tipppausen, Verbot von Aufzählungen/Textbausteinen/Wiederholungen, kein „48-Stunden"-Versprechen mehr, Rückmeldung direkt im Anschluss. Aktiv wird das erst nach dem nächsten Deploy; Mandanten mit eigenem gespeichertem Prompt müssen einmal in den AI-Einstellungen nachziehen (das übernehme ich als Teil des Audits unten).

## 1. Go-Live-Checkliste pro Mandant (neu)

Eine dezente Checkliste, die automatisch prüft, ob ein Mandant wirklich startklar ist — keine Handarbeit, sondern echte Prüfungen gegen die Daten.

Geprüft wird je Mandant:
- **Versand**: SMTP vollständig hinterlegt, letzter Test erfolgreich, Versand nicht pausiert, Absenderadresse gesetzt.
- **Auftritt**: Landingpage vorhanden und veröffentlicht, Domain/Alias gesetzt, Logo und Farbe hinterlegt.
- **Vermittlung**: Vermittlungsseite bzw. verknüpfte Fast-Track-Seite vorhanden (falls der Mandant vermittelt).
- **Termine**: Terminkalender angelegt, mindestens eine Verfügbarkeitsregel, Zeitzone Europe/Berlin, Vorlaufzeit plausibel.
- **Interview**: Modus gesetzt (Chat/Voice), System- und Entscheidungs-Prompt vorhanden, kein veralteter „48-Stunden"-Satz im Prompt.
- **Mails**: alle Kernvorlagen befüllt (Bewerbung eingegangen, Terminbestätigung, Terminerinnerung, kein Termin, No-Show, Zusage/Einladung, Registrierungs-Erinnerung).
- **Onboarding**: Teamleiter zugewiesen, Standard-Aufgabenpaket gesetzt, Vertragsvorlage je freigegebener Vertragsart vorhanden, Firmendaten für den Vertrag (Adresse, Geschäftsführer, Unterschrift) komplett.

Darstellung:
- In der Mandantenliste ein dezenter Fortschrittspunkt (z. B. „9/12") neben dem Namen; grün = startklar, gelb = Kleinigkeiten offen, rot = blockierend.
- Klick öffnet ein Panel mit den Punkten, je Punkt Status, Klartext-Erklärung und Direktlink zur richtigen Stelle (Kalender, Landingpage, Mailvorlagen …).
- Blockierende Punkte (SMTP kaputt, kein Kalender, keine Landingpage) werden oben zuerst gezeigt.

## 2. SMTP-Test schlägt fehl („Failed to send a request to the Edge Function")

Das ist kein Namecheap-Fehler: Der Browser erreicht die Prüf-Funktion gar nicht (Backend-Funktion nicht/veraltet deployed oder Netz). Geplant:
- SMTP-Test zusätzlich über eine portal-eigene Serverfunktion, die als Fallback greift — damit ist der Test unabhängig vom Backend-Deploy.
- Fehlermeldungen klar trennen: „Prüf-Funktion nicht erreichbar" vs. „SMTP-Login abgelehnt (falsches Passwort)".
- Nach erfolgreichem Test wird der Mandant wie bisher automatisch entpausiert.

## 3. Gesamt-Audit vor der Werbeschaltung

Durchgängiger Test der Kette ohne echte Bewerber: Bewerbung eingegangen → Terminbestätigung → Terminerinnerung → kein Termin (24 h/72 h) → No-Show → Zusage/Willkommen → Registrierungs-Erinnerungen. Je Stufe: Auslöser, Cron-Lauf, Vorlage, Absender/Branding, Protokolleintrag, Doppelversand-Sperre. Ergebnis als grün/rot-Bericht plus Behebung der Lücken. Mandanten mit SMTP-Fehler (DGG Beratung, W3 Personal) werden gesondert ausgewiesen.

## 4. Chat-Anhänge Mitarbeiter ↔ Admin

Bereits vorhanden (Bilder, PDF, Word, Excel, Text, max. 10 MB, in beiden Chats). Zu prüfen: ob der Speicherort „chat-attachments" auf dem Self-Hosting-Backend existiert und die Zugriffsregeln stimmen — sonst schlägt der Upload still fehl. Falls nötig anlegen und in beide Richtungen testen.

## 5. Vertragsarten je Mandant festlegen

- Neues Feld pro Mandant: welche Vertragsarten angeboten werden (beliebige Kombination aus Minijob, Teilzeit, Vollzeit).
- Auswahl in der Mandanten-Bearbeitung, mindestens eine Art muss aktiv bleiben.
- Registrierung zeigt nur freigegebene Arten; bei genau einer wird sie vorausgewählt.
- Serverseitige Absicherung gegen gesperrte Arten. Bestandsmandanten behalten alle drei.

## Technische Details

- Checkliste: `src/lib/tenant-readiness.functions.ts` (Admin-geschützt) sammelt pro Mandant Prüfergebnisse aus `tenants`, `tenant_smtp_health`, `landing_pages`, `availability_schedules`/`availability_rules`, `contract_templates`, `tenant_default_tasks`; UI als `TenantReadinessPanel.tsx`, eingebunden in `admin.tenants.tsx` (Badge + Dialog). Reine Leseprüfung, keine Schemaänderung nötig.
- SMTP-Test: neue `createServerFn` mit Admin-Rollenprüfung, Wiederverwendung von `createSmtpTransport`; Aufrufer nutzen Edge-Function mit Fallback.
- Vertragsarten: Migration `tenants.allowed_employment_types text[]` (Default alle drei, Prüfung auf gültige, nicht leere Werte); Anpassung `StepEmployment.tsx`, Registrierungs-Flow, Mandantenverwaltung.
- Audit stützt sich auf `scripts/mail-audit.sh`, `scripts/verify-mail-matrix.sh`, `scripts/check-mail-health.sh` sowie Abfragen auf `email_send_log`, `application_reminder_log`, `cron.job`.
