-- SMTP-Login-, Verbindungs- und Gatewayfehler sind Absender-/Serverprobleme.
-- Frühere Versionen haben sie fälschlich als Empfängerfehler gezählt und damit
-- gültige Bewerberadressen nach drei Versuchen gesperrt.
UPDATE public.email_recipient_failures
   SET consecutive_failures = 0,
       suppressed_at = NULL,
       updated_at = now()
 WHERE suppressed_at IS NOT NULL
   AND lower(coalesce(last_error, '')) ~
       '(invalid login|535|eauth|authentication failed|greeting never received|timeout|etimedout|econn|gateway|502|503|504)';