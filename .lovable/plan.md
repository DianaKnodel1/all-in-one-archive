## Status Landing-Server (uwkconsulting)

Erledigt und bestätigt: `server.js`, `legal-content.js` und `heartbeat.sh` sind vom Portal geladen, `SERVER_FILES_BASE` steht in der `.env`, beide Dienste laufen stabil, `/_health` antwortet `ok`, keine `ERR_MODULE_NOT_FOUND`-Crashes mehr im Journal. Dort ist nichts weiter zu tun.

## Problem im Portal-Projekt

Der Build bricht ab:

```text
[auth-guard] Deployment gestoppt: src/start.ts muss ausschließlich
attachSupabaseBearer als functionMiddleware verwenden.
```

Ursache (verifiziert): `src/start.ts` importiert Zeile 6 wieder `attachSupabaseAuth` und listet ihn in Zeile 25 als `functionMiddleware: [attachSupabaseAuth, attachSupabaseBearer]`. Das Guard-Skript `scripts/ensure-auth-middleware.mjs` verlangt exakt `functionMiddleware: [attachSupabaseBearer]` und verbietet jede Erwähnung von `attachSupabaseAuth`. Dieser Zustand wird bei jedem Regenerieren der Supabase-Integration erneut eingespielt — deshalb taucht der Fehler wiederholt auf.

## Umsetzung

1. `src/start.ts` bereinigen:
   - Import von `attachSupabaseAuth` entfernen
   - `functionMiddleware: [attachSupabaseBearer]`
2. `scripts/ensure-auth-middleware.mjs` von "Build abbrechen" auf "selbst reparieren" umstellen: wenn `attachSupabaseAuth` gefunden wird, Import- und Array-Eintrag automatisch entfernen, Datei zurückschreiben, Hinweis loggen und mit Exit 0 weiterlaufen. Nur wenn `attachSupabaseBearer` komplett fehlt, weiterhin hart abbrechen.

Damit kann derselbe Auto-Re-Import den Build künftig nicht mehr blockieren.

## Danach

Auf dem Portal-Server `git pull && ./scripts/deploy.sh`, dann in der Portal-UI prüfen, dass Server 1 (uwkconsulting) per Heartbeat als **online** angezeigt wird, und einen Theme-Resync auslösen, um den `/internal/flush`-Pfad einmal end-to-end zu bestätigen.
