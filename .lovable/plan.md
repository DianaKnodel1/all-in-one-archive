## Befund

Das Mail-Center liest ungefiltert aus `email_send_log` (`src/routes/admin.email-center.tsx`) — es zeigt also alles an, was protokolliert wird. Die "Bewerbung eingegangen"-Mail fehlt, weil in bestimmten Fällen **gar kein Log-Eintrag geschrieben wird**:

1. `supabase/functions/send-invitation-email/index.ts` protokolliert erst kurz vor dem SMTP-Versand. Alle früheren Abbrüche kehren ohne Log zurück:
   - `routing_skip: …` (409)
   - Tenant nicht gefunden (404) / Tenant deaktiviert (503)
   - unvollständige SMTP-Konfiguration (400)
   - manuell pausierter Mandant (503)
   - unerwarteter Fehler im äußeren `catch`
2. `src/routes/api/public/applications.ts` schreibt nur bei **Fehlern** in `email_send_log` (`writeMailFailureLog`); „sent" und „skipped" landen ausschließlich in der Server-Konsole. Bei einem Abbruch nach Punkt 1 entsteht dadurch nirgends eine Zeile.

Damit ist eine tatsächlich nicht versendete oder blockierte Bewerbungsbestätigung im Mail-Center unsichtbar — genau das soll sich ändern.

## Ziel

Jede ausgehende (oder bewusst unterdrückte) E-Mail erzeugt genau eine Zeile in `email_send_log` — mit Status `sent`, `failed` oder `skipped` und einem maschinenlesbaren Grund.

## Umsetzung

### 1. Versand-Function lückenlos protokollieren
`supabase/functions/send-invitation-email/index.ts`:
- Log-Helfer nach oben ziehen und für jeden frühen Abbruch aufrufen (Routing-Skip, Tenant fehlt/inaktiv, SMTP unvollständig, manuelle Pause, äußerer Fehler).
- Status-Konvention: bewusste Unterdrückung → `skipped`, technischer/Konfigurationsfehler → `failed`.
- `metadata.skip_reason` bzw. `error_message` immer setzen, damit der Grund im Center sichtbar ist.
- Fällt der Tenant weg, Eintrag mit `tenant_id = null` schreiben statt still zu verwerfen.

### 2. Gleiche Behandlung in den übrigen Versand-Functions
Durchgehen und fehlende Abbruchpfade nachziehen (gleiches Muster):
`send-password-reset`, `send-signup-confirmation`, `resend-signup-confirmation`, `send-chat-reminder`, `process-invite-resend-queue`, `email-resend`.

### 3. Bewerbungsroute: Erfolg und Skip ebenfalls loggen
`src/routes/api/public/applications.ts`:
- `writeMailFailureLog` zu einem allgemeinen `writeMailLog(template, status, reason, metadata)` erweitern.
- `logMailResult` schreibt künftig auch bei `sent` und `skipped` eine Zeile — bei `sent` als Ergänzung (siehe Dedup unten).
- Ist die Function selbst schon nicht erreichbar oder liefert 409/503, entsteht damit garantiert ein Eintrag.

### 4. Doppelzeilen vermeiden
Die Function schreibt bei erfolgreichem Versand bereits eine Zeile. Damit im Verlauf nicht zwei Zeilen pro Mail stehen:
- Die Route setzt beim Aufruf eine `request_id` und übergibt sie an die Function; die Function schreibt sie in `metadata.request_id`.
- Die Route protokolliert `sent` nur, wenn zu dieser `request_id` noch kein Eintrag existiert (kurzer Lookup vor dem Insert).

### 5. Zusage-/Einladungsmail aus dem Interview
`src/lib/interview-engine.server.ts` prüfen: der zentrale Einladungsversand muss denselben Log-Pfad nutzen (auch bei „nicht gesendet, weil …").

### 6. Prüfskript
`scripts/mail-audit.sh` um einen Abschnitt „Versandwege ohne Protokoll" erweitern: vergleicht Bewerbungen mit `invite_mail_status`/Eingangsbestätigung gegen vorhandene `email_send_log`-Zeilen und listet Lücken der letzten 7 Tage auf.

## Technische Hinweise

- Keine Schema-Änderung nötig: `email_send_log` hat bereits `status`, `error_message`, `metadata`, `rendered_subject`, `rendered_html`.
- Der bestehende `guardSend`-Pfad (`_shared/send-guard.ts`) protokolliert Blockaden bereits korrekt und bleibt unverändert.
- Nach dem Deploy sind neue Sends vollständig sichtbar; rückwirkend lassen sich fehlende Zeilen nicht rekonstruieren.

## Deploy danach

```bash
# Portal
cd /opt/apps/portal && git reset --hard HEAD && git pull && bash scripts/deploy.sh
# Backend
cd /opt/apps/portal-migrations && git pull && bash scripts/deploy-backend-local.sh
```
