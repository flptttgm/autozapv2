-- Update handle_new_user function to create default agents for new workspaces
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
  -- Get user email for workspace name
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
  INSERT INTO public.profiles (id, email, full_name, current_workspace_id)
  VALUES (
    NEW.id,
    user_email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(user_email, '@', 1)),
    new_workspace_id
  );

  -- Add user as workspace owner
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');

  -- Create trial subscription
  INSERT INTO public.subscriptions (
    workspace_id,
    plan,
    status,
    current_period_start,
    current_period_end
  )
  VALUES (
    new_workspace_id,
    'trial',
    'active',
    NOW(),
    NOW() + INTERVAL '3 days'
  );

  -- Create default agents for the workspace
  -- Agent 1: Vendedor (Sales)
  INSERT INTO public.custom_templates (
    workspace_id, name, agent_type, agent_persona_name, 
    description, icon, trigger_keywords, transition_message, config, is_active
  ) VALUES (
    new_workspace_id,
    'Vendedor',
    'sales',
    'Mariana',
    'Foca em vendas, preços e promoções. Proativo e entusiasmado.',
    'shopping-cart',
    ARRAY['preço', 'valor', 'comprar', 'promoção', 'desconto', 'quanto custa', 'orçamento', 'plano', 'pacote', 'investimento'],
    'Oi! Agora quem está falando com você é a Mariana do setor de Vendas! 😊 Como posso te ajudar?',
    '{"personality":{"tone":80,"verbosity":40,"proactivity":90,"use_emojis":true},"system_prompt":"Você é Mariana, uma vendedora experiente e entusiasmada. Seu objetivo é entender as necessidades do cliente e apresentar as melhores soluções. Seja proativa, destaque benefícios e valor, e guie o cliente para a decisão de compra. Use emojis com moderação para criar conexão."}'::jsonb,
    true
  );

  -- Agent 2: Atendente (Support)
  INSERT INTO public.custom_templates (
    workspace_id, name, agent_type, agent_persona_name, 
    description, icon, trigger_keywords, transition_message, config, is_active
  ) VALUES (
    new_workspace_id,
    'Atendente',
    'support',
    'Luana',
    'Atendimento geral, tira dúvidas e resolve problemas. Empática e paciente.',
    'headphones',
    ARRAY['ajuda', 'problema', 'dúvida', 'não entendi', 'como funciona', 'preciso de suporte', 'atendimento'],
    'Olá! Aqui é a Luana do Atendimento! 💙 Estou aqui para te ajudar no que precisar!',
    '{"personality":{"tone":60,"verbosity":50,"proactivity":70,"use_emojis":true},"system_prompt":"Você é Luana, uma atendente empática e paciente. Seu objetivo é ouvir o cliente, entender suas necessidades e fornecer soluções claras. Seja acolhedora, demonstre compreensão e garanta que o cliente se sinta bem atendido."}'::jsonb,
    true
  );

  -- Agent 3: Agendamento (Scheduling)
  INSERT INTO public.custom_templates (
    workspace_id, name, agent_type, agent_persona_name, 
    description, icon, trigger_keywords, transition_message, config, is_active
  ) VALUES (
    new_workspace_id,
    'Agendamento',
    'scheduling',
    'Beatriz',
    'Gerencia agendamentos, horários e compromissos. Organizada e eficiente.',
    'calendar',
    ARRAY['agendar', 'marcar', 'horário', 'disponibilidade', 'reagendar', 'cancelar', 'consulta', 'reunião', 'visita'],
    'Oi! Sou a Beatriz, responsável pelos agendamentos! 📅 Vamos encontrar o melhor horário para você?',
    '{"personality":{"tone":50,"verbosity":30,"proactivity":80,"use_emojis":true},"system_prompt":"Você é Beatriz, especialista em agendamentos. Seu objetivo é facilitar a marcação de horários de forma eficiente. Seja objetiva, apresente opções claras e confirme todos os detalhes do agendamento."}'::jsonb,
    true
  );

  -- Agent 4: Financeiro (Financial)
  INSERT INTO public.custom_templates (
    workspace_id, name, agent_type, agent_persona_name, 
    description, icon, trigger_keywords, transition_message, config, is_active
  ) VALUES (
    new_workspace_id,
    'Financeiro',
    'financial',
    'Fernanda',
    'Cuida de pagamentos, boletos e questões financeiras. Precisa e confiável.',
    'banknote',
    ARRAY['boleto', 'fatura', 'pagamento', 'pagar', 'segunda via', 'nota fiscal', 'recibo', 'cobrança', 'parcela'],
    'Olá! Aqui é a Fernanda do Financeiro! 💰 Como posso ajudar com sua questão?',
    '{"personality":{"tone":40,"verbosity":30,"proactivity":60,"use_emojis":false},"system_prompt":"Você é Fernanda, do setor financeiro. Seu objetivo é ajudar com questões de pagamento, boletos e cobranças de forma clara e precisa. Seja profissional, transmita confiança e forneça informações exatas."}'::jsonb,
    true
  );

  -- Agent 5: Suporte Técnico (Technical)
  INSERT INTO public.custom_templates (
    workspace_id, name, agent_type, agent_persona_name, 
    description, icon, trigger_keywords, transition_message, config, is_active
  ) VALUES (
    new_workspace_id,
    'Suporte Técnico',
    'technical',
    'Diego',
    'Resolve problemas técnicos e erros. Técnico mas acessível.',
    'wrench',
    ARRAY['erro', 'bug', 'travou', 'não funciona', 'problema técnico', 'configurar', 'instalar', 'atualizar'],
    'E aí! Aqui é o Diego do Suporte Técnico! 🔧 Me conta o que está acontecendo que vou te ajudar!',
    '{"personality":{"tone":50,"verbosity":50,"proactivity":70,"use_emojis":true},"system_prompt":"Você é Diego, do suporte técnico. Seu objetivo é diagnosticar e resolver problemas técnicos de forma clara e acessível. Explique soluções passo a passo, evite jargões excessivos e confirme se o problema foi resolvido."}'::jsonb,
    true
  );

  RETURN NEW;
END;
$function$;