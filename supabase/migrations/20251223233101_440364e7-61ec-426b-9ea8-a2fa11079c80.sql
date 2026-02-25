-- Add columns to email_automations for frequency control
ALTER TABLE public.email_automations
ADD COLUMN IF NOT EXISTS max_sends_per_user integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS min_hours_between_sends integer DEFAULT NULL;

-- Update existing automations with proper limits
UPDATE public.email_automations SET max_sends_per_user = 1, min_hours_between_sends = NULL WHERE trigger_type = 'trial_24h';
UPDATE public.email_automations SET max_sends_per_user = 1, min_hours_between_sends = NULL WHERE trigger_type = 'trial_6h';
UPDATE public.email_automations SET max_sends_per_user = 1, min_hours_between_sends = NULL WHERE trigger_type = 'trial_expired';
UPDATE public.email_automations SET max_sends_per_user = 2, min_hours_between_sends = 48 WHERE trigger_type = 'whatsapp_not_connected';
UPDATE public.email_automations SET max_sends_per_user = 1, min_hours_between_sends = NULL WHERE trigger_type = 'new_signup';
UPDATE public.email_automations SET max_sends_per_user = 2, min_hours_between_sends = 72 WHERE trigger_type = 'inactive_7_days';
UPDATE public.email_automations SET max_sends_per_user = 1, min_hours_between_sends = NULL WHERE trigger_type = 'subscription_activated';