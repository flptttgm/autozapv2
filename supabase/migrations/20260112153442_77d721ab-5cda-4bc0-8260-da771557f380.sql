-- Add column to store mobile registration state
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS mobile_registration_state jsonb DEFAULT NULL;

COMMENT ON COLUMN public.whatsapp_instances.mobile_registration_state IS 
'Estado do registro mobile em andamento: {step, phone, method, startedAt, expiresAt, captchaImage}';