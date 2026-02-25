-- Add members_limit column to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN members_limit integer NOT NULL DEFAULT 3;

-- Update limits based on current plan type
UPDATE public.subscriptions SET members_limit = 1 WHERE plan_type = 'trial';
UPDATE public.subscriptions SET members_limit = 3 WHERE plan_type = 'start';
UPDATE public.subscriptions SET members_limit = 10 WHERE plan_type = 'pro';
UPDATE public.subscriptions SET members_limit = 50 WHERE plan_type = 'business';