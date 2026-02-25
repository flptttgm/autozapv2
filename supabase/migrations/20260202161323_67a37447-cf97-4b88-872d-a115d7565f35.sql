
-- Re-enable the triggers
ALTER TABLE public.subscriptions ENABLE TRIGGER on_subscription_upgrade;
ALTER TABLE public.subscriptions ENABLE TRIGGER on_subscription_plan_change;
