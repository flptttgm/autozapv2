-- Fix handle_new_user trigger: convert ARRAY[] to jsonb for trigger_keywords column
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
BEGIN
  user_email := NEW.email;
  workspace_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(user_email, '@', 1)
  ) || '''s Workspace';

  -- Create workspace
  INSERT INTO public.workspaces (name, owner_id)
  VALUES (workspace_name, NEW.id)
  RETURNING id INTO new_workspace_id;

  -- Create profile
  INSERT INTO public.profiles (id, full_name, workspace_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(user_email, '@', 1)),
    new_workspace_id
  );

  -- Add user as workspace owner
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');

  -- Create trial subscription
  INSERT INTO public.subscriptions (
    workspace_id, plan_type, status, trial_ends_at
  ) VALUES (
    new_workspace_id, 'trial', 'active', NOW() + INTERVAL '3 days'
  );

  -- Create default agents (FIXED: using jsonb format for trigger_keywords)
  -- Agent 1: Vendedor
  INSERT INTO public.custom_templates (
    workspace_id, name, agent_type, agent_persona_name, 
    description, icon, trigger_keywords, transition_message, config
  ) VALUES (
    new_workspace_id, 'Vendedor', 'sales', 'Mariana',
    'Foca em vendas, preços e promoções. Proativo e entusiasmado.',
    'shopping-cart',
    '["preço", "valor", "comprar", "promoção", "desconto", "quanto custa", "orçamento", "plano", "pacote", "investimento"]'::jsonb,
    'Oi! Agora quem está falando com você é a Mariana do setor de Vendas! Como posso te ajudar?',
    '{"personality":{"tone":80,"verbosity":40,"proactivity":90,"use_emojis":true}}'::jsonb
  );

  -- Agent 2: Atendente
  INSERT INTO public.custom_templates (
    workspace_id, name, agent_type, agent_persona_name, 
    description, icon, trigger_keywords, transition_message, config
  ) VALUES (
    new_workspace_id, 'Atendente', 'support', 'Luana',
    'Atendimento geral, tira dúvidas e resolve problemas. Empática e paciente.',
    'headphones',
    '["ajuda", "problema", "dúvida", "não entendi", "como funciona", "preciso de suporte", "atendimento"]'::jsonb,
    'Olá! Aqui é a Luana do Atendimento! Estou aqui para te ajudar no que precisar!',
    '{"personality":{"tone":60,"verbosity":50,"proactivity":70,"use_emojis":true}}'::jsonb
  );

  -- Agent 3: Agendamento
  INSERT INTO public.custom_templates (
    workspace_id, name, agent_type, agent_persona_name, 
    description, icon, trigger_keywords, transition_message, config
  ) VALUES (
    new_workspace_id, 'Agendamento', 'scheduling', 'Beatriz',
    'Gerencia agendamentos, horários e compromissos. Organizada e eficiente.',
    'calendar',
    '["agendar", "marcar", "horário", "disponibilidade", "reagendar", "cancelar", "consulta", "reunião", "visita"]'::jsonb,
    'Oi! Sou a Beatriz, responsável pelos agendamentos! Vamos encontrar o melhor horário para você?',
    '{"personality":{"tone":50,"verbosity":30,"proactivity":80,"use_emojis":true}}'::jsonb
  );

  -- Agent 4: Financeiro
  INSERT INTO public.custom_templates (
    workspace_id, name, agent_type, agent_persona_name, 
    description, icon, trigger_keywords, transition_message, config
  ) VALUES (
    new_workspace_id, 'Financeiro', 'financial', 'Fernanda',
    'Cuida de pagamentos, boletos e questões financeiras. Precisa e confiável.',
    'banknote',
    '["boleto", "fatura", "pagamento", "pagar", "segunda via", "nota fiscal", "recibo", "cobrança", "parcela"]'::jsonb,
    'Olá! Aqui é a Fernanda do Financeiro! Como posso ajudar com sua questão?',
    '{"personality":{"tone":40,"verbosity":30,"proactivity":60,"use_emojis":false}}'::jsonb
  );

  -- Agent 5: Suporte Técnico
  INSERT INTO public.custom_templates (
    workspace_id, name, agent_type, agent_persona_name, 
    description, icon, trigger_keywords, transition_message, config
  ) VALUES (
    new_workspace_id, 'Suporte Técnico', 'technical', 'Diego',
    'Resolve problemas técnicos e erros. Técnico mas acessível.',
    'wrench',
    '["erro", "bug", "travou", "não funciona", "problema técnico", "configurar", "instalar", "atualizar"]'::jsonb,
    'E aí! Aqui é o Diego do Suporte Técnico! Me conta o que está acontecendo que vou te ajudar!',
    '{"personality":{"tone":50,"verbosity":50,"proactivity":70,"use_emojis":true}}'::jsonb
  );

  RETURN NEW;
END;
$function$;