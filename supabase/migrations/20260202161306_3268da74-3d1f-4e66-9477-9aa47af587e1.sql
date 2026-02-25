
-- Disable only the user-defined triggers that might cause issues
ALTER TABLE public.subscriptions DISABLE TRIGGER on_subscription_upgrade;
ALTER TABLE public.subscriptions DISABLE TRIGGER on_subscription_plan_change;
