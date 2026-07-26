## 1. Was war mit den zwei Vorlagen geplant?

**`reminder_appointment_subject` / `_body`**
Geplant als "30 Minuten vor dem Termin"-Erinnerung: Ein Cron alle 10 Minuten sucht Buchungen, die in 25–40 Minuten starten, und schickt genau eine Mail pro Buchung (Idempotenz über `appointment_reminder_log`). Platzhalter waren `{{first_name}}`, `{{appointment_date}}`, `{{appointment_time}}`, `{{tenant_name}}`, `{{portal_link}}`.

Warum sie heute nichts tut: Die Funktion, die dafür gebaut wurde, wurde später auf den Interview-Flow umgebaut. Sie versendet jetzt im selben 25–40-Minuten-Fenster die Interview-Einladung mit Magic-Link und benutzt dafür die Vorlage `bewerbung_magic_link_*`. Der ursprüngliche Termin-Reminder-Cron wurde ausdrücklich abgeschaltet. Die zwei Spalten sind also Altbestand — sie werden von keiner Versandlogik mehr gelesen, egal was man dort einträgt.

**`reminder_recovery_bewerber_subject` / `_body`**
Geplant für den Domain-Wechsel: Wenn die aktive Versand-Domain eines Mandanten getauscht wird, bekommen alle Kontakte eine Mail mit dem neuen Portal-Link. Die Empfänger sollten in zwei Gruppen mit unterschiedlichem Text aufgeteilt werden — Mitarbeiter (`reminder_recovery_*`) und bereits akzeptierte Bewerber (`reminder_recovery_bewerber_*`).

Warum sie heute nichts tut: Die Empfängerermittlung wurde bewusst auf Mitarbeiter reduziert; Bewerber sind laut Kommentar im Code ausgenommen, weil sie ohnehin über den normalen Einladungs-Reminder einen aktuellen Link bekommen. Die Bewerber-Gruppe wird also nie erzeugt, die Vorlage nie geladen.

## 2. Warum ist der Landing-Server "offline"?

Nicht kaputt, sondern nie angeschlossen. Das Portal betreibt einen Heartbeat-Endpunkt, der alle 60 Sekunden eine Meldung mit dem Bootstrap-Token des Servers erwartet und daraus Status und Landing-Zahl setzt. Die Oberfläche zeigt "Offline", sobald länger als 5 Minuten keine Meldung kam.

Auf dem Landing-Server existiert aber gar kein Agent, der das sendet: Das Setup installiert nur den Renderer und Caddy, kein Heartbeat, kein Timer, kein Token in der Konfiguration. Deshalb bleibt `last_heartbeat_at` leer und der Eintrag dauerhaft offline — auch wenn die Landing Pages selbst normal ausgeliefert werden.

## Vorschlag zum Aufräumen

**A) Reminder-Vorlagen entwirren (empfohlen)**
- Im Mail-Vorlagen-Bereich die zwei toten Vorlagen ausblenden bzw. sichtbar als "derzeit nicht im Einsatz" kennzeichnen, damit niemand Texte pflegt, die nie rausgehen.
- Alternativ auf Wunsch: die Bewerber-Variante der Domain-Wechsel-Mail wieder scharf schalten (akzeptierte Bewerber als eigene Empfängergruppe) oder den echten 30-Minuten-Termin-Reminder zusätzlich zum Interview-Flow wieder aufsetzen. Das ist echte Funktionalität und sollte separat entschieden werden.

**B) Heartbeat für Landing-Server nachrüsten**
- Kleiner Agent im Landing-Server-Paket, der minütlich Status, Renderer-Gesundheit und Version ans Portal meldet und das Resync-Kommando entgegennimmt.
- Setup erweitert um Token-Eintrag und einen Dienst/Timer für den Agent.
- Kurzanleitung im Landing-Server-README: Token aus der Infrastruktur-Seite kopieren, eintragen, Dienst starten — danach springt die Anzeige auf Online.

### Technische Details
- Betroffene Vorlagen: `tenants.reminder_appointment_*`, `tenants.reminder_recovery_bewerber_*` (nur Schema, keine Leser).
- Endpunkt: `src/routes/api/public/landing-server-heartbeat.ts` erwartet `{ token, agent_version, renderer_healthy, resync_done }`; Antwort enthält `resync_needed`.
- Agent-Neuanlage unter `landing-server/`, Einbindung in `landing-server/setup.sh` als systemd-Timer; keine Datenbankänderung nötig, `landing_servers` hat alle Felder bereits.
