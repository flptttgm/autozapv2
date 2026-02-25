-- Criar tabela de workspaces (equipes)
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Criar tabela de membros do workspace
CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Criar tabela de convites
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Adicionar workspace_id ao profiles
ALTER TABLE public.profiles ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Função para criar workspace automaticamente quando usuário se cadastra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_workspace_id uuid;
BEGIN
  -- Criar workspace pessoal
  INSERT INTO public.workspaces (name, owner_id)
  VALUES (
    COALESCE(new.raw_user_meta_data ->> 'full_name', 'Meu Workspace'),
    new.id
  )
  RETURNING id INTO new_workspace_id;
  
  -- Criar profile vinculado ao workspace
  INSERT INTO public.profiles (id, full_name, workspace_id)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new_workspace_id
  );
  
  -- Adicionar usuário como owner do workspace
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, new.id, 'owner');
  
  RETURN new;
END;
$$;

-- Função helper para obter workspace_id do usuário
CREATE OR REPLACE FUNCTION public.get_user_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.profiles WHERE id = auth.uid();
$$;

-- REMOVER TODAS AS POLÍTICAS ANTIGAS ANTES DE MODIFICAR COLUNAS

-- Remover políticas de leads
DROP POLICY IF EXISTS "Users can view own leads" ON leads;
DROP POLICY IF EXISTS "Users can create own leads" ON leads;
DROP POLICY IF EXISTS "Users can update own leads" ON leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON leads;

-- Remover políticas de messages
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Users can create own messages" ON messages;
DROP POLICY IF EXISTS "Users can update own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON messages;

-- Remover políticas de appointments
DROP POLICY IF EXISTS "Users can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Users can create own appointments" ON appointments;
DROP POLICY IF EXISTS "Users can update own appointments" ON appointments;
DROP POLICY IF EXISTS "Users can delete own appointments" ON appointments;

-- Remover políticas de chat_memory
DROP POLICY IF EXISTS "Users can view own chat_memory" ON chat_memory;
DROP POLICY IF EXISTS "Users can create own chat_memory" ON chat_memory;
DROP POLICY IF EXISTS "Users can update own chat_memory" ON chat_memory;
DROP POLICY IF EXISTS "Users can delete own chat_memory" ON chat_memory;

-- Remover políticas de message_buffer
DROP POLICY IF EXISTS "Users can view own message_buffer" ON message_buffer;
DROP POLICY IF EXISTS "Users can create own message_buffer" ON message_buffer;
DROP POLICY IF EXISTS "Users can update own message_buffer" ON message_buffer;
DROP POLICY IF EXISTS "Users can delete own message_buffer" ON message_buffer;

-- Remover políticas de calendar_integrations
DROP POLICY IF EXISTS "Users can view own calendar_integrations" ON calendar_integrations;
DROP POLICY IF EXISTS "Users can create own calendar_integrations" ON calendar_integrations;
DROP POLICY IF EXISTS "Users can update own calendar_integrations" ON calendar_integrations;
DROP POLICY IF EXISTS "Users can delete own calendar_integrations" ON calendar_integrations;

-- Remover políticas de system_config
DROP POLICY IF EXISTS "Users can view own system_config" ON system_config;
DROP POLICY IF EXISTS "Users can create own system_config" ON system_config;
DROP POLICY IF EXISTS "Users can update own system_config" ON system_config;
DROP POLICY IF EXISTS "Users can delete own system_config" ON system_config;

-- AGORA SUBSTITUIR user_id por workspace_id

ALTER TABLE public.leads DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.leads ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.messages DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.messages ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.appointments DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.appointments ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.chat_memory DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.chat_memory ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.message_buffer DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.message_buffer ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.calendar_integrations DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.calendar_integrations ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.system_config DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.system_config ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- CRIAR POLÍTICAS RLS PARA WORKSPACES

CREATE POLICY "Users can view workspaces they are members of"
ON public.workspaces FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own workspace"
ON public.workspaces FOR UPDATE
TO authenticated
USING (owner_id = auth.uid());

-- CRIAR POLÍTICAS PARA workspace_members

CREATE POLICY "Members can view their workspace members"
ON public.workspace_members FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can add workspace members"
ON public.workspace_members FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can remove workspace members"
ON public.workspace_members FOR DELETE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- CRIAR POLÍTICAS PARA invites

CREATE POLICY "Members can view workspace invites"
ON public.invites FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can create invites"
ON public.invites FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can update invites"
ON public.invites FOR UPDATE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- CRIAR POLÍTICAS PARA leads

CREATE POLICY "Members can view workspace leads"
ON public.leads FOR SELECT
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can create workspace leads"
ON public.leads FOR INSERT
TO authenticated
WITH CHECK (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can update workspace leads"
ON public.leads FOR UPDATE
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can delete workspace leads"
ON public.leads FOR DELETE
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

-- CRIAR POLÍTICAS PARA messages

CREATE POLICY "Members can view workspace messages"
ON public.messages FOR SELECT
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can create workspace messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can update workspace messages"
ON public.messages FOR UPDATE
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can delete workspace messages"
ON public.messages FOR DELETE
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

-- CRIAR POLÍTICAS PARA appointments

CREATE POLICY "Members can view workspace appointments"
ON public.appointments FOR SELECT
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can create workspace appointments"
ON public.appointments FOR INSERT
TO authenticated
WITH CHECK (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can update workspace appointments"
ON public.appointments FOR UPDATE
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can delete workspace appointments"
ON public.appointments FOR DELETE
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

-- CRIAR POLÍTICAS PARA chat_memory

CREATE POLICY "Members can view workspace chat_memory"
ON public.chat_memory FOR SELECT
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can create workspace chat_memory"
ON public.chat_memory FOR INSERT
TO authenticated
WITH CHECK (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can update workspace chat_memory"
ON public.chat_memory FOR UPDATE
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can delete workspace chat_memory"
ON public.chat_memory FOR DELETE
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

-- CRIAR POLÍTICAS PARA message_buffer

CREATE POLICY "Members can view workspace message_buffer"
ON public.message_buffer FOR SELECT
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can create workspace message_buffer"
ON public.message_buffer FOR INSERT
TO authenticated
WITH CHECK (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can update workspace message_buffer"
ON public.message_buffer FOR UPDATE
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can delete workspace message_buffer"
ON public.message_buffer FOR DELETE
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

-- CRIAR POLÍTICAS PARA calendar_integrations

CREATE POLICY "Members can view workspace calendar_integrations"
ON public.calendar_integrations FOR SELECT
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can create workspace calendar_integrations"
ON public.calendar_integrations FOR INSERT
TO authenticated
WITH CHECK (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can update workspace calendar_integrations"
ON public.calendar_integrations FOR UPDATE
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can delete workspace calendar_integrations"
ON public.calendar_integrations FOR DELETE
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

-- CRIAR POLÍTICAS PARA system_config

CREATE POLICY "Members can view workspace system_config"
ON public.system_config FOR SELECT
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can create workspace system_config"
ON public.system_config FOR INSERT
TO authenticated
WITH CHECK (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can update workspace system_config"
ON public.system_config FOR UPDATE
TO authenticated
USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Members can delete workspace system_config"
ON public.system_config FOR DELETE
TO authenticated
USING (workspace_id = public.get_user_workspace_id());