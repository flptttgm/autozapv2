-- ============================================
-- 06c. Auth Trigger Function (Part 3 of 3)
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_workspace_id uuid;
  workspace_name text;
  user_email text;
  user_whatsapp text;
  support_agent_id uuid;
BEGIN
  user_email := NEW.email;
  user_whatsapp := NEW.raw_user_meta_data->>'whatsapp_number';

  workspace_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(user_email, '@', 1)
  ) || '''s Workspace';

  -- A. Create workspace
  INSERT INTO public.workspaces (name, owner_id)
  VALUES (workspace_name, NEW.id)
  RETURNING id INTO new_workspace_id;

  -- B. Create profile
  INSERT INTO public.profiles (id, full_name, workspace_id, whatsapp_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(user_email, '@', 1)),
    new_workspace_id,
    user_whatsapp
  );

  -- C. Add user as workspace owner
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');

  -- D. Create trial subscription
  INSERT INTO public.subscriptions (workspace_id, plan_type, status, trial_ends_at)
  VALUES (new_workspace_id, 'trial', 'active', NOW() + INTERVAL '3 days');

  -- E1. Agent: Vendedor
  INSERT INTO public.custom_templates (
    workspace_id, name, agent_type, agent_persona_name,
    description, icon, trigger_keywords, transition_message, config
  ) VALUES (
    new_workspace_id, 'Vendedor', 'sales', 'Mariana',
    'Foca em vendas, preços e promoções.',
    'shopping-cart',
    '["preço","valor","comprar","promoção","desconto","quanto custa"]'::jsonb,
    'Oi! Aqui é a Mariana de Vendas!',
    '{"personality":{"tone":80,"verbosity":40,"proactivity":90,"use_emojis":true}}'::jsonb
  );

  -- E2. Agent: Atendente (default)
  INSERT INTO public.custom_templates (
    workspace_id, name, agent_type, agent_persona_name,
    description, icon, trigger_keywords, transition_message, config
  ) VALUES (
    new_workspace_id, 'Atendente', 'support', 'Luana',
    'Atendimento geral, tira dúvidas.',
    'headphones',
    '["ajuda","problema","dúvida","como funciona","suporte","atendimento"]'::jsonb,
    'Olá! Aqui é a Luana do Atendimento!',
    '{"personality":{"tone":60,"verbosity":50,"proactivity":70,"use_emojis":true}}'::jsonb
  )
  RETURNING id INTO support_agent_id;

  -- E3. Agent: Agendamento
  INSERT INTO public.custom_templates (
    workspace_id, name, agent_type, agent_persona_name,
    description, icon, trigger_keywords, transition_message, config
  ) VALUES (
    new_workspace_id, 'Agendamento', 'scheduling', 'Beatriz',
    'Gerencia agendamentos e horários.',
    'calendar',
    '["agendar","marcar","horário","reagendar","cancelar","consulta"]'::jsonb,
    'Oi! Sou a Beatriz dos agendamentos!',
    '{"personality":{"tone":50,"verbosity":30,"proactivity":80,"use_emojis":true}}'::jsonb
  );

  -- E4. Agent: Financeiro
  INSERT INTO public.custom_templates (
    workspace_id, name, agent_type, agent_persona_name,
    description, icon, trigger_keywords, transition_message, config
  ) VALUES (
    new_workspace_id, 'Financeiro', 'financial', 'Fernanda',
    'Cuida de pagamentos e boletos.',
    'banknote',
    '["boleto","fatura","pagamento","pagar","nota fiscal","cobrança"]'::jsonb,
    'Olá! Aqui é a Fernanda do Financeiro!',
    '{"personality":{"tone":40,"verbosity":30,"proactivity":60,"use_emojis":false}}'::jsonb
  );

  -- E5. Agent: Suporte Técnico
  INSERT INTO public.custom_templates (
    workspace_id, name, agent_type, agent_persona_name,
    description, icon, trigger_keywords, transition_message, config
  ) VALUES (
    new_workspace_id, 'Suporte Técnico', 'technical', 'Diego',
    'Resolve problemas técnicos.',
    'wrench',
    '["erro","bug","travou","não funciona","configurar","instalar"]'::jsonb,
    'E aí! Aqui é o Diego do Suporte Técnico!',
    '{"personality":{"tone":50,"verbosity":50,"proactivity":70,"use_emojis":true}}'::jsonb
  );

  -- F. Create routing config
  INSERT INTO public.agent_routing_config (
    workspace_id, is_routing_enabled, routing_mode,
    transition_style, hybrid_threshold, default_agent_id
  ) VALUES (
    new_workspace_id, true, 'hybrid', 'friendly', 0.70, support_agent_id
  );

  RETURN NEW;
END;
$function$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

SELECT 'Part 3/3 done: Auth trigger ready! Signup should now work.' as result;
