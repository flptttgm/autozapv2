-- Alterar o valor padrão de 'all' para 'selective' para novas instâncias WhatsApp
ALTER TABLE public.whatsapp_instances 
ALTER COLUMN ai_mode SET DEFAULT 'selective';