-- Atomare Sperre für konkrete E-Mail-Ereignisse.
-- Ein event_key darf nur einmal pending oder sent sein. Fehlgeschlagene Claims
-- blockieren keinen späteren kontrollierten Retry.

CREATE UNIQUE INDEX IF NOT EXISTS email_send_log_unique_active_event
  ON public.email_send_log ((metadata->>'event_key'))
  WHERE metadata->>'event_key' IS NOT NULL
    AND status IN ('pending', 'sent');

COMMENT ON INDEX public.email_send_log_unique_active_event IS
  'Verhindert parallelen Doppelversand desselben fachlichen E-Mail-Ereignisses.';