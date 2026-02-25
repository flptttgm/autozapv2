-- Adicionar campos de frequência na tabela whatsapp_message_templates
ALTER TABLE public.whatsapp_message_templates
ADD COLUMN IF NOT EXISTS min_hours_between_sends INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS max_sends_per_lead INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS send_window_start TIME DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS send_window_end TIME DEFAULT '20:00',
ADD COLUMN IF NOT EXISTS delay_after_trigger_minutes INTEGER DEFAULT 5;

-- Comentários para documentação
COMMENT ON COLUMN whatsapp_message_templates.min_hours_between_sends IS 'Intervalo mínimo em horas entre envios do mesmo tipo';
COMMENT ON COLUMN whatsapp_message_templates.max_sends_per_lead IS 'Número máximo de vezes que um lead pode receber este template';
COMMENT ON COLUMN whatsapp_message_templates.send_window_start IS 'Hora de início da janela de envio (horário de Brasília)';
COMMENT ON COLUMN whatsapp_message_templates.send_window_end IS 'Hora de término da janela de envio (horário de Brasília)';
COMMENT ON COLUMN whatsapp_message_templates.delay_after_trigger_minutes IS 'Tempo de espera após trigger antes de enviar';