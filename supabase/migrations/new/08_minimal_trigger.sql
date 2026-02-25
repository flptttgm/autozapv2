-- ============================================
-- 08. Minimal Auth Trigger (safe version)
-- This creates the simplest possible trigger
-- to get signup working immediately
-- ============================================

-- Replace the trigger with a MINIMAL version
-- that only creates workspace + profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_workspace_id uuid;
BEGIN
  -- A. Create workspace (minimal)
  INSERT INTO public.workspaces (name, owner_id)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace',
    NEW.id
  )
  RETURNING id INTO new_workspace_id;

  -- B. Create profile (minimal)
  INSERT INTO public.profiles (id, full_name, workspace_id, whatsapp_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    new_workspace_id,
    NEW.raw_user_meta_data->>'whatsapp_number'
  );

  -- C. Workspace member (try, skip if table doesn't exist)
  BEGIN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, NEW.id, 'owner');
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE 'workspace_members skipped';
  END;

  -- D. Subscription (try, skip if table doesn't exist)
  BEGIN
    INSERT INTO public.subscriptions (workspace_id, plan_type, status, trial_ends_at)
    VALUES (new_workspace_id, 'trial', 'active', NOW() + INTERVAL '3 days');
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE 'subscriptions skipped';
  END;

  -- E. Custom templates (try, skip if fails)
  BEGIN
    INSERT INTO public.custom_templates (
      workspace_id, name, agent_type, agent_persona_name,
      description, icon, trigger_keywords, transition_message, config
    ) VALUES (
      new_workspace_id, 'Atendente', 'support', 'Luana',
      'Atendimento geral.',
      'headphones',
      '["ajuda","problema","dúvida"]'::jsonb,
      'Olá! Aqui é a Luana!',
      '{"personality":{"tone":60,"verbosity":50,"proactivity":70,"use_emojis":true}}'::jsonb
    );
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE 'custom_templates skipped';
  END;

  RETURN NEW;
END;
$function$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

SELECT 'Minimal trigger installed! Try signup now.' as result;
