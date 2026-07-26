# E-Mail Test-Suite

Schnelles, sicheres Testen aller automatischen Bewerber-/Mitarbeiter-Mails
ohne Wartezeit auf reale Trigger.

## Voraussetzungen

```bash
export SUPABASE_URL="https://<PROJECT>.supabase.co"      # oder self-hosted URL
export SERVICE_ROLE="<SERVICE_ROLE_KEY>"                 # aus /opt/apps/portal/.env
export DATABASE_URL="postgresql://…"                     # nur für Stufe 4 + 5
export TEST_TENANT_ID="<broker-tenant-uuid>"             # Tenant der Source-Landing (Vermittlung)
export TEST_SOURCE_LANDING_ID="<uuid>"                   # Vermittlungs-Landing (flow_type='broker')
export TEST_TARGET_LANDING_ID="<uuid>"                   # Fast-Track-/Ziel-Landing
export TEST_EMAIL="test+chain@deine-domain.de"           # test+ empfohlen; andere Adressen über ALLOWED_TEST_EMAILS

# Klassischer Einzel-Landing-Test (kein Vermittlungsflow): stattdessen
# nur TEST_LANDING_ID setzen – wird dann als Source UND Target genutzt.
# export TEST_LANDING_ID="<uuid>"
```

### Passende IDs für den Vermittlungs-Test finden

```sql
SELECT l.id, l.slug, l.domain, l.flow_type, l.tenant_id, t.name AS tenant_name
FROM landing_pages l JOIN tenants t ON t.id = l.tenant_id
WHERE l.flow_type IN ('broker','fast')
ORDER BY l.flow_type, t.name;
```

Beispiel personalservice (Vermittlung) → bv-agentur (Fast-Track):

```bash
export TEST_TENANT_ID="<tenant_id der personalservice-Zeile>"
export TEST_SOURCE_LANDING_ID="8d4a3aac-ad75-4083-a153-fe4c8960b61b"  # personalservice
export TEST_TARGET_LANDING_ID="<id der bv-agentur-Zeile>"
```


## Ebene 1 — Rendering-Preview (Sekunden, KEIN Versand)

Ein einzelnes Template als HTML im Browser ansehen:

```bash
curl -s -X POST "$SUPABASE_URL/functions/v1/email-preview?format=html" \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d "{\"template\": \"booking_confirmation\", \"tenant_id\": \"$TEST_TENANT_ID\"}" \
  > /tmp/preview.html && xdg-open /tmp/preview.html
```

## Ebene 2 — Einmal-Testversand an deine eigene Adresse

```bash
curl -s -X POST "$SUPABASE_URL/functions/v1/email-preview" \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d "{\"template\": \"application_received\", \"tenant_id\": \"$TEST_TENANT_ID\", \"send_to\": \"$TEST_EMAIL\"}"
```

## Ebene 3 — Dry-Run gegen echte Cron-Daten

```bash
bash scripts/email-test/dry-run-all.sh
```

## Ebene 4 — Einzelnen Cron-Send auslösen (mit vordatiertem Test-Bewerber)

State-Snippets in `sql-snippets/chain-*.sql` einzeln laufen lassen und
danach die passende Function triggern. Siehe `set-test-states.sql` für
Kommentare zu jeder Manipulation.

## Ebene 5 — Komplette Kette mit EINEM Skript

Sendet nacheinander **alle 14 automatischen Mails** an `$TEST_EMAIL` – jede
mit echter State-Manipulation und echtem Cron-Aufruf.

```bash
bash scripts/email-test/run-full-chain.sh
```

### Self-hosted: Testsuite vollständig auf den Backend-Server kopieren

Runner und SQL-Snippets bilden eine gemeinsame Version. Deshalb niemals nur
eine einzelne Datei kopieren. Auf dem Frontend-Server ausführen:

```bash
cd /opt/apps/portal
tar -czf /tmp/email-test-suite.tgz -C scripts email-test
scp /tmp/email-test-suite.tgz root@190.97.167.123:/tmp/
ssh root@190.97.167.123 \
  'rm -rf /opt/apps/portal-migrations/scripts/email-test && mkdir -p /opt/apps/portal-migrations/scripts && tar -xzf /tmp/email-test-suite.tgz -C /opt/apps/portal-migrations/scripts'
```

Beim Start zeigt der Runner seine Suite-Version. Sein Vorabcheck stoppt vor
dem ersten Versand, wenn alte `ON CONFLICT`-Snippets oder benötigte
Datenbankfelder fehlen.

Was das Skript macht (pro Stufe):

1. Lädt `sql-snippets/chain-<n>-*.sql`, das per `psql` den Test-Bewerber in
   den richtigen Zustand versetzt (backdated `created_at`, Termin auf
   `cancelled`, o. ä.) und die passende Zeile aus
   `application_reminder_log` löscht.
2. Ruft die zuständige Edge Function auf (`send-application-reminders`,
   `send-booking-confirmation`, `send-appointment-reminders`,
   `send-invitation-email`, `send-signup-confirmation`,
   `resend-signup-confirmation`, `send-password-reset`, `send-reminders`).
3. Wartet `PAUSE_SECONDS` (Standard 6s) gegen SMTP-Rate-Limit.

Ablauf im Postfach:

```
 1/14 application_received            → test+chain@…
 2/14 booking_confirmation            → test+chain@…
 3/14 interview_invite_30min          → test+chain@…
 4/14 no_booking_24h                  → test+chain@…
 5/14 no_booking_72h                  → test+chain@…
 6/14 no_show_24h                     → test+chain@…
 7/14 rebook_after_cancel_24h         → test+chain@…
 8/14 rebook_after_cancel_72h         → test+chain@…
 9/14 welcome_invitation              → test+chain@…
10/14 signup_confirmation             → test+chain@…
11/14 signup_confirmation_resend      → test+chain@…
12/14 password_reset                  → test+chain@…
13/14 reminder_invite                 → test+chain@…
14/14 reminder_complete_registration  → test+chain@…
```

Einzelne Stufen überspringen:

```bash
SKIP="no_show_24h,password_reset" bash scripts/email-test/run-full-chain.sh
```

Am Ende fragt das Skript, ob `chain-99-cleanup.sql` laufen soll (Zeiten
zurücksetzen, Log leeren) – damit ist der nächste Durchlauf sofort möglich.

## Sicherheits-Regeln

- **`TEST_EMAIL` sollte mit `test+` beginnen** – sonst bricht das Skript ab. Ausnahmen können über `ALLOWED_TEST_EMAILS` freigegeben werden.
- Alle SQL-Updates sind auf **genau eine** `applications`-Row per E-Mail gescoped.
- Preview-Endpoint: nur Service-Role.
- Nach dem Test: Cleanup ausführen oder Test-Bewerber löschen.
