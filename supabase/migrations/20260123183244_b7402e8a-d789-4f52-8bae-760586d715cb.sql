-- Function to call the sync-workspace-instances edge function
CREATE OR REPLACE FUNCTION public.trigger_workspace_instances_sync()
RETURNS TRIGGER AS $$
DECLARE
  result JSONB;
BEGIN
  -- Only trigger if plan changed from 'trial' to a paid plan
  IF OLD.plan_type = 'trial' AND NEW.plan_type IN ('start', 'pro', 'business') THEN
    -- Call the edge function via pg_net (async HTTP call)
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/sync-workspace-instances',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'workspace_id', NEW.workspace_id::text,
        'trigger_source', 'subscription_upgrade'
      )
    );
    
    RAISE LOG '[trigger_workspace_instances_sync] Triggered sync for workspace % (plan: % -> %)', 
      NEW.workspace_id, OLD.plan_type, NEW.plan_type;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on subscriptions table
DROP TRIGGER IF EXISTS on_subscription_upgrade ON public.subscriptions;

CREATE TRIGGER on_subscription_upgrade
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW
  WHEN (OLD.plan_type IS DISTINCT FROM NEW.plan_type)
  EXECUTE FUNCTION public.trigger_workspace_instances_sync();

-- Add comment for documentation
COMMENT ON FUNCTION public.trigger_workspace_instances_sync() IS 
  'Automatically syncs all WhatsApp instances when a workspace upgrades from trial to a paid plan';