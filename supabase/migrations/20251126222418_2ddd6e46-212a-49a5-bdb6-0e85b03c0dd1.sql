-- Fase 1: Corrigir Políticas RLS (Recursão Infinita)

-- Remover políticas com recursão em workspace_members
DROP POLICY IF EXISTS "Members can view their workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Admins can add workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Admins can remove workspace members" ON workspace_members;

-- Criar função security definer para verificar se usuário é admin/owner
CREATE OR REPLACE FUNCTION public.is_workspace_admin(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND role IN ('owner', 'admin')
  )
$$;

-- Novas políticas sem recursão
CREATE POLICY "Users can view workspace members where they are members"
ON workspace_members FOR SELECT
USING (
  user_id = auth.uid() OR 
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can add workspace members"
ON workspace_members FOR INSERT
WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Admins can remove workspace members"
ON workspace_members FOR DELETE
USING (public.is_workspace_admin(workspace_id, auth.uid()));

-- Fase 2: Migrar Dados Existentes

-- Atualizar leads sem workspace_id (usar o workspace do primeiro profile)
UPDATE leads 
SET workspace_id = (
  SELECT workspace_id FROM profiles WHERE workspace_id IS NOT NULL LIMIT 1
) 
WHERE workspace_id IS NULL;

-- Atualizar messages sem workspace_id (usar workspace_id do lead associado)
UPDATE messages 
SET workspace_id = (
  SELECT l.workspace_id FROM leads l WHERE l.id = messages.lead_id
) 
WHERE workspace_id IS NULL AND lead_id IS NOT NULL;

-- Atualizar appointments sem workspace_id
UPDATE appointments 
SET workspace_id = (
  SELECT l.workspace_id FROM leads l WHERE l.id = appointments.lead_id
) 
WHERE workspace_id IS NULL AND lead_id IS NOT NULL;

-- Atualizar chat_memory sem workspace_id
UPDATE chat_memory 
SET workspace_id = (
  SELECT l.workspace_id FROM leads l WHERE l.id = chat_memory.lead_id
) 
WHERE workspace_id IS NULL AND lead_id IS NOT NULL;

-- Atualizar message_buffer sem workspace_id
UPDATE message_buffer 
SET workspace_id = (
  SELECT l.workspace_id FROM leads l WHERE l.id = message_buffer.lead_id
) 
WHERE workspace_id IS NULL AND lead_id IS NOT NULL;

-- Atualizar calendar_integrations sem workspace_id
UPDATE calendar_integrations 
SET workspace_id = (
  SELECT l.workspace_id FROM leads l WHERE l.id = calendar_integrations.lead_id
) 
WHERE workspace_id IS NULL AND lead_id IS NOT NULL;

-- Fase 3: Adicionar FK entre workspace_members e profiles
ALTER TABLE workspace_members 
ADD CONSTRAINT fk_workspace_members_profiles 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;