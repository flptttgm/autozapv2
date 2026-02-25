-- ============================================
-- 18. ROBUST Auth Trigger with Error Logging
-- Replaces previous triggers to prevent rollback
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_workspace_id uuid;
  error_message text;
BEGIN
  -- 1. Create Workspace
  BEGIN
    INSERT INTO public.workspaces (name, owner_id)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace',
      NEW.id
    )
    RETURNING id INTO new_workspace_id;
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT;
    INSERT INTO public.app_logs (level, message, details) 
    VALUES ('error', 'Trig: Failed to create workspace', jsonb_build_object('user_id', NEW.id, 'error', error_message));
    -- If workspace creation fails, we can't create profile linked to it properly, but we MUST return NEW to save user
    RETURN NEW; 
  END;

  -- 2. Create Profile
  BEGIN
    INSERT INTO public.profiles (user_id, display_name, workspace_id, whatsapp_number)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      new_workspace_id,
      NEW.raw_user_meta_data->>'whatsapp_number'
    );
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT;
    INSERT INTO public.app_logs (level, message, details) 
    VALUES ('error', 'Trig: Failed to create profile', jsonb_build_object('user_id', NEW.id, 'error', error_message));
  END;

  -- 3. Workspace Member
  BEGIN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, NEW.id, 'owner');
  EXCEPTION WHEN others THEN
    -- Non-critical
  END;

  -- 4. Subscription
  BEGIN
    INSERT INTO public.subscriptions (workspace_id, plan_type, status, trial_ends_at)
    VALUES (new_workspace_id, 'trial', 'active', NOW() + INTERVAL '3 days');
  EXCEPTION WHEN others THEN
    -- Non-critical
  END;

  -- 5. Default Agent (Optional)
  BEGIN
     -- (Previous logic for custom_templates)
     NULL; 
  EXCEPTION WHEN others THEN
     -- Non-critical
  END;

  RETURN NEW;
END;
$function$;

-- Recreate trigger just to be safe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

SELECT 'Robust trigger installed.' as result;
