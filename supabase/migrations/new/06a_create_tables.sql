-- ============================================
-- 06a. Create Missing Tables (Part 1 of 3)
-- ============================================

-- 1. PROFILES
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

-- 2. WORKSPACE_MEMBERS
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- 3. SUBSCRIPTIONS
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

-- 4. CUSTOM_TEMPLATES
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

ALTER TABLE public.custom_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_custom_templates_workspace ON public.custom_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_custom_templates_agent_type ON public.custom_templates(agent_type);

-- 5. AGENT_ROUTING_CONFIG
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

-- 6. INVITES
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

SELECT 'Part 1/3 done: All tables created!' as result;
