-- APPLY MANUALLY:
--   sed "s|<SUPABASE_URL>|api.dein-backend.de|g; s|<CRON_SECRET>|$DEIN_SECRET|g" \
--     supabase/manual-migrations/20260804000000_smtp_pause_logic.sql \
--     | docker exec -i supabase-db psql -U postgres -d postgres
--
-- Neue Pausen-Logik:
--   1) Alt-Pausen aus dem Domain-Health-Job (auto:domain_down) aufheben.
--      Domain-Ausfall pausiert den Mail-Versand ab sofort nicht mehr.
--   2) SMTP-Health-Cron alle 30 Min registrieren. Er pausiert bei 3
--      SMTP-Fehlern in Folge und gibt automatisch wieder frei.

-- 1) Alt-Pausen aufheben ------------------------------------------------

-- actor_id ist NOT NULL -> Systemeintrag auf einen Admin schreiben.
-- Gibt es keinen Admin, wird das Protokoll uebersprungen.
INSERT INTO public.activity_log (actor_id, action, entity_type, entity_id, comment)
SELECT
  admin.user_id,
  'emails_reaktiviert',
  'tenant',
  t.id,
  'Automatisch freigegeben: Pause stammte aus dem Domain-Health-Job. '
  || 'Domain-Ausfall stoppt den Mail-Versand nicht mehr — nur noch SMTP-Fehler.'
FROM public.tenants t
CROSS JOIN LATERAL (
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
  ORDER BY ur.user_id
  LIMIT 1
) AS admin
WHERE t.emails_paused = true
  AND t.emails_paused_by = 'auto:domain_down';

UPDATE public.tenants
SET emails_paused = false,
    emails_paused_at = NULL,
    emails_paused_reason = NULL,
    emails_paused_by = NULL,
    updated_at = now()
WHERE emails_paused = true
  AND emails_paused_by = 'auto:domain_down';

-- 2) SMTP-Health-Cron ---------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT jobid FROM cron.job WHERE jobname = 'smtp-health-cron' LOOP
    BEGIN
      PERFORM cron.unschedule(r.jobid);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END$$;

SELECT cron.schedule(
  'smtp-health-cron',
  '*/30 * * * *',
  $CRON$
  SELECT net.http_post(
    url := 'https://<SUPABASE_URL>/functions/v1/smtp-health-cron?key=<CRON_SECRET>',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $CRON$
);
