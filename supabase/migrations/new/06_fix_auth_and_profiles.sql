-- ============================================
-- 06. Fix Auth: Create Missing Tables & Trigger
-- Run this in Supabase SQL Editor to fix signup/login
-- ============================================

-- ============================================
-- 1. PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company_name TEXT,
  avatar_url TEXT,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  onboarding_completed BOOLEAN DEFAULT false,
  has_password BOOLEAN DEFAULT true,
  pwa_dismissed BOOLEAN DEFAULT false,
  whatsapp_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Service role full access (for edge functions)
DROP POLICY IF EXISTS "Service role full access" ON public.profiles;
CREATE POLICY "Service role full access"
  ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 2. WORKSPACE_MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their workspace members" ON public.workspace_members;
CREATE POLICY "Members can view their workspace members"
  ON public.workspace_members FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role full access" ON public.workspace_members;
CREATE POLICY "Service role full access"
  ON public.workspace_members FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 3. SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'trial',
  connections_limit INT NOT NULL DEFAULT 1,
  connections_extra INT NOT NULL DEFAULT 0,
  billing_cycle TEXT DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'active',
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.subscriptions;
CREATE POLICY "Service role full access"
  ON public.subscriptions FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 4. CUSTOM_TEMPLATES TABLE (AI Agent Templates)
-- ============================================
CREATE TABLE IF NOT EXISTS public.custom_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'user-cog',
  config JSONB NOT NULL DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,
  agent_type VARCHAR(50) DEFAULT 'general',
  agent_persona_name VARCHAR(100),
  trigger_keywords JSONB DEFAULT '[]',
  trigger_intents JSONB DEFAULT '[]',
  transition_message TEXT,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_templates_workspace ON public.custom_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_custom_templates_agent_type ON public.custom_templates(agent_type);

ALTER TABLE public.custom_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.custom_templates;
CREATE POLICY "Service role full access"
  ON public.custom_templates FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 5. AGENT_ROUTING_CONFIG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_routing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  is_routing_enabled BOOLEAN DEFAULT false,
  default_agent_id UUID REFERENCES public.custom_templates(id) ON DELETE SET NULL,
  routing_mode VARCHAR(50) DEFAULT 'keywords',
  transition_style VARCHAR(50) DEFAULT 'friendly',
  hybrid_threshold FLOAT DEFAULT 0.70,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id)
);

ALTER TABLE public.agent_routing_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.agent_routing_config;
CREATE POLICY "Service role full access"
  ON public.agent_routing_config FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 6. INVITES TABLE (optional, for team features)
-- ============================================
CREATE TABLE IF NOT EXISTS public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.invites;
CREATE POLICY "Service role full access"
  ON public.invites FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 7. HELPER FUNCTION: get_user_workspace_id()
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================
-- 8. RLS POLICIES FOR EXISTING TABLES (workspace-based)
-- ============================================

-- Subscriptions: user can view own
DROP POLICY IF EXISTS "Members can view workspace subscription" ON public.subscriptions;
CREATE POLICY "Members can view workspace subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

-- Custom templates: user can manage own
DROP POLICY IF EXISTS "Members can view workspace custom_templates" ON public.custom_templates;
CREATE POLICY "Members can view workspace custom_templates"
  ON public.custom_templates FOR SELECT
  TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Members can create workspace custom_templates" ON public.custom_templates;
CREATE POLICY "Members can create workspace custom_templates"
  ON public.custom_templates FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Members can update workspace custom_templates" ON public.custom_templates;
CREATE POLICY "Members can update workspace custom_templates"
  ON public.custom_templates FOR UPDATE
  TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Members can delete workspace custom_templates" ON public.custom_templates;
CREATE POLICY "Members can delete workspace custom_templates"
  ON public.custom_templates FOR DELETE
  TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

-- Agent routing config: user can manage own
DROP POLICY IF EXISTS "Workspace members can view routing config" ON public.agent_routing_config;
CREATE POLICY "Workspace members can view routing config"
  ON public.agent_routing_config FOR SELECT
  TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Workspace members can insert routing config" ON public.agent_routing_config;
CREATE POLICY "Workspace members can insert routing config"
  ON public.agent_routing_config FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Workspace members can update routing config" ON public.agent_routing_config;
CREATE POLICY "Workspace members can update routing config"
  ON public.agent_routing_config FOR UPDATE
  TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

-- Workspaces: user can view own
DROP POLICY IF EXISTS "Users can view workspaces they are members of" ON public.workspaces;
CREATE POLICY "Users can view workspaces they are members of"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
    OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update their own workspace" ON public.workspaces;
CREATE POLICY "Users can update their own workspace"
  ON public.workspaces FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- ============================================
-- 9. HANDLE_NEW_USER TRIGGER FUNCTION (COMPLETE)
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

  -- D. Create trial subscription (3 days)
  INSERT INTO public.subscriptions (
    workspace_id, plan_type, status, trial_ends_at
  ) VALUES (
    new_workspace_id, 'trial', 'active', NOW() + INTERVAL '3 days'
  );

  -- E. Create default AI agents
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

  -- Agent 2: Atendente (support - default agent)
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
  )
  RETURNING id INTO support_agent_id;

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

  -- F. Create routing config (hybrid mode, Luana as default)
  INSERT INTO public.agent_routing_config (
    workspace_id,
    is_routing_enabled,
    routing_mode,
    transition_style,
    hybrid_threshold,
    default_agent_id
  ) VALUES (
    new_workspace_id,
    true,
    'hybrid',
    'friendly',
    0.70,
    support_agent_id
  );

  RETURN NEW;
END;
$function$;

-- ============================================
-- 10. RECREATE THE TRIGGER
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 11. UPDATE_UPDATED_AT helper (if missing)
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to new tables
DO $$ BEGIN
  CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_custom_templates_updated_at BEFORE UPDATE ON public.custom_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Done!
SELECT 'Auth fix complete! Signup and login should now work.' as result;
