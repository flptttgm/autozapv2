-- Criar tabela de profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  company_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Função para criar profile automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

-- Trigger para criar profile quando usuário se cadastrar
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Adicionar user_id às tabelas existentes
ALTER TABLE public.leads ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.chat_memory ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.message_buffer ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.calendar_integrations ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.system_config ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Remover políticas antigas de "Enable all operations"
DROP POLICY IF EXISTS "Enable all operations on leads" ON leads;
DROP POLICY IF EXISTS "Enable all operations on messages" ON messages;
DROP POLICY IF EXISTS "Enable all operations on appointments" ON appointments;
DROP POLICY IF EXISTS "Enable all operations on chat_memory" ON chat_memory;
DROP POLICY IF EXISTS "Enable all operations on message_buffer" ON message_buffer;
DROP POLICY IF EXISTS "Enable all operations on calendar_integrations" ON calendar_integrations;

-- Criar políticas RLS restritivas para leads
CREATE POLICY "Users can view own leads"
ON public.leads FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own leads"
ON public.leads FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads"
ON public.leads FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own leads"
ON public.leads FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Criar políticas RLS para messages
CREATE POLICY "Users can view own messages"
ON public.messages FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own messages"
ON public.messages FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
ON public.messages FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Criar políticas RLS para appointments
CREATE POLICY "Users can view own appointments"
ON public.appointments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own appointments"
ON public.appointments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own appointments"
ON public.appointments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own appointments"
ON public.appointments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Criar políticas RLS para chat_memory
CREATE POLICY "Users can view own chat_memory"
ON public.chat_memory FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own chat_memory"
ON public.chat_memory FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat_memory"
ON public.chat_memory FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat_memory"
ON public.chat_memory FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Criar políticas RLS para message_buffer
CREATE POLICY "Users can view own message_buffer"
ON public.message_buffer FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own message_buffer"
ON public.message_buffer FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own message_buffer"
ON public.message_buffer FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own message_buffer"
ON public.message_buffer FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Criar políticas RLS para calendar_integrations
CREATE POLICY "Users can view own calendar_integrations"
ON public.calendar_integrations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own calendar_integrations"
ON public.calendar_integrations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar_integrations"
ON public.calendar_integrations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar_integrations"
ON public.calendar_integrations FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Criar políticas RLS para system_config (manter as existentes + adicionar restrição por user_id)
CREATE POLICY "Users can view own system_config"
ON public.system_config FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own system_config"
ON public.system_config FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own system_config"
ON public.system_config FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own system_config"
ON public.system_config FOR DELETE
TO authenticated
USING (auth.uid() = user_id);