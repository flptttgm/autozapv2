-- Add asaas_subscription_id column to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT DEFAULT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_subscription_id 
ON public.subscriptions(asaas_subscription_id) 
WHERE asaas_subscription_id IS NOT NULL;