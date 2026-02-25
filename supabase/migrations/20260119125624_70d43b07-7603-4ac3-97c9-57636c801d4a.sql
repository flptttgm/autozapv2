-- Add columns to payments_history for credit purchases
ALTER TABLE public.payments_history 
ADD COLUMN IF NOT EXISTS purchase_type TEXT DEFAULT 'subscription',
ADD COLUMN IF NOT EXISTS credits_amount INTEGER;

-- Add comment for clarity
COMMENT ON COLUMN public.payments_history.purchase_type IS 'Type of purchase: subscription, connection, or credits';
COMMENT ON COLUMN public.payments_history.credits_amount IS 'Number of prospect credits purchased (only for credits purchase_type)';