-- ============================================
-- 10. FIXED Auth Trigger (matches actual schema)
-- The profiles table uses user_id + display_name
-- NOT id + full_name
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_workspace_id uuid;
BEGIN
  -- A. Create workspace
  INSERT INTO public.workspaces (name, owner_id)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace',
    NEW.id
  )
  RETURNING id INTO new_workspace_id;

  -- B. Create profile (FIXED: user_id + display_name)
  INSERT INTO public.profiles (user_id, display_name, workspace_id, whatsapp_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    new_workspace_id,
    NEW.raw_user_meta_data->>'whatsapp_number'
  );

  -- C. Workspace member
  BEGIN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, NEW.id, 'owner');
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'workspace_members skipped: %', SQLERRM;
  END;

  -- D. Subscription
  BEGIN
    INSERT INTO public.subscriptions (workspace_id, plan_type, status, trial_ends_at)
    VALUES (new_workspace_id, 'trial', 'active', NOW() + INTERVAL '3 days');
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'subscriptions skipped: %', SQLERRM;
  END;

  -- E. Default agent
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
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'custom_templates skipped: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

SELECT 'FIXED trigger installed! Try signup now.' as result;
