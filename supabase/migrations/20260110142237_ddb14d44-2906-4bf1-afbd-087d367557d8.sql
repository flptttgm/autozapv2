-- Agendar check-new-accounts para rodar a cada minuto
-- Este job verifica usuários que criaram conta há 5+ minutos mas não conectaram WhatsApp
SELECT cron.schedule(
  'check-new-accounts-every-minute',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ldcqgdrutloatcmtxquw.supabase.co/functions/v1/check-new-accounts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);