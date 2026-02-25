-- Criar enum para roles da plataforma
CREATE TYPE public.platform_role AS ENUM ('platform_admin', 'platform_moderator', 'user');

-- Criar tabela de roles da plataforma
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role platform_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Criar função para verificar se é platform_admin (SECURITY DEFINER para evitar recursão)
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'platform_admin'
  )
$$;

-- Políticas RLS para user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Platform admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert roles" ON public.user_roles
  FOR INSERT WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update roles" ON public.user_roles
  FOR UPDATE USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete roles" ON public.user_roles
  FOR DELETE USING (public.is_platform_admin(auth.uid()));

-- Criar tabela de logs globais da plataforma
CREATE TABLE public.platform_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS para platform_logs
ALTER TABLE public.platform_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para platform_logs (apenas platform_admins podem ver)
CREATE POLICY "Platform admins can view logs" ON public.platform_logs
  FOR SELECT USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert logs" ON public.platform_logs
  FOR INSERT WITH CHECK (public.is_platform_admin(auth.uid()));

-- Criar índices para performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_platform_logs_created_at ON public.platform_logs(created_at DESC);
CREATE INDEX idx_platform_logs_user_id ON public.platform_logs(user_id);
CREATE INDEX idx_platform_logs_action ON public.platform_logs(action);