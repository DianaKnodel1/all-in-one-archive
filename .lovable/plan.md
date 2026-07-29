## Ausgangslage

Heute pausiert ein Domain-Ping-Job den kompletten Mailversand eines Tenants, sobald alle Domains kurz nicht antworten – und hebt das nie wieder auf. Das ist die falsche Kopplung: **Mails gehen über SMTP raus, nicht über die Webseite.** Eine kurz nicht erreichbare Landing Page ist kein Grund, Bewerbungs- und Reminder-Mails zu stoppen. Deshalb wird die Logik umgebaut.

## Neue Regel (Kern)

| Situation | Bisher | Neu |
|---|---|---|
| Alle Domains offline | Versand gestoppt, für immer | **Kein Stopp.** Nur Warnung im Admin + Activity-Log |
| SMTP-Login schlägt 3× in Folge fehl | Versand gestoppt, für immer | Versand gestoppt (bleibt sinnvoll) |
| SMTP funktioniert wieder | nichts | **Pause wird automatisch aufgehoben** |
| Admin pausiert von Hand | Versand gestoppt | Bleibt gestoppt, kein Auto-Resume |

Links in Mails zeigen ohnehin auf die aktive Versand-Domain – fällt die aus, greift weiterhin der bestehende Domain-Wechsel („Aktiv setzen").

## Umsetzung

**1. Domain-Job entkoppeln** (`src/routes/api/public/domain-health-cron.ts`)
- Auto-Pause-Block entfernen. Stattdessen Activity-Log-Eintrag „Alle Domains offline – Links in Mails könnten ins Leere zeigen" und ein Warn-Flag pro Tenant.
- Antwort-Auswertung verfeinern: HTTP 404 mit „Keine Landing konfiguriert" gilt nicht mehr als „ok", sondern als eigener Status **„erreichbar, keine Landing"** (gelb) in der Domain-Übersicht.

**2. Alt-Pausen aufräumen**
- Migration: alle Tenants mit `emails_paused_by = 'auto:domain_down'` werden entpausiert (betrifft GTM, MM, CAC, DGG) und der Vorgang im Activity-Log vermerkt.

**3. SMTP-Status als einzige Wahrheit** (`tenant_smtp_health`)
- Neuer Health-Cron alle 30 Min: prüft je aktivem Tenant den SMTP-Login (nur Verbindung + AUTH, kein Mailversand) und schreibt `last_verify_ok`, `last_fail_error`, `consecutive_fails`.
- Erfolgreicher Verify hebt eine `auto:*`-Pause automatisch auf und setzt den Fehlerzähler zurück.
- Tenants ohne SMTP-Daten werden als „nicht konfiguriert" markiert, nicht als Fehler.

**4. Admin-Anzeige neu** (`src/routes/admin.tenants.tsx`)
Statt einem grünen Badge vier klare Zustände pro Tenant:
- 🟢 **SMTP OK** – letzter Check erfolgreich, mit Zeitstempel
- 🔴 **SMTP-Fehler** – mit letzter Fehlermeldung im Tooltip (z. B. „535 authentication failed")
- ⚪ **SMTP nicht hinterlegt** – Zugangsdaten fehlen
- ⏸ **Pausiert** – mit Grund (manuell / SMTP-Fehler) und Freigabe-Button

Dazu ein **„SMTP jetzt testen"**-Button direkt in der Zeile, der sofort prüft und bei Erfolg die Pause aufhebt.

**5. Stille Ausfälle sichtbar machen**
- Blockierte Mails (Pause, SMTP tot, kein Empfänger) werden bereits geloggt – im Mail Center kommt ein Warnbanner „X Mails wurden wegen SMTP-Problemen nicht versendet" mit Sprung zur betroffenen Domain.
- Optional gleich mit umgesetzt: Button „Blockierte Mails nachsenden" pro Tenant, sobald SMTP wieder grün ist.

## Technische Details

- Kein Schema-Umbau nötig; `tenant_smtp_health` und `tenants.emails_paused*` bleiben. Eine Migration nur für das Entpausieren der Alt-Fälle.
- Der SMTP-Check nutzt die bestehende `smtp-test`-Edge-Function (kann bereits pausierte Tenants testen und entpausieren) – sie bekommt einen Batch-Modus für den Cron.
- Cron per pg_cron auf den bestehenden `/api/public/*`-Weg, analog zum Domain-Health-Job.

## Danach offen (nicht Teil dieses Plans)

LH Marketing braucht ein korrektes SMTP-Passwort; MuS Marketing, W3 Personal und ODB haben noch gar keine SMTP-Daten. Nach dem Umbau siehst du das direkt an den Badges statt über Umwege.
