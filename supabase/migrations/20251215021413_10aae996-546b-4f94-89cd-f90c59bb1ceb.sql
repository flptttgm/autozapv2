-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE,
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

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Members can view workspace subscription"
ON public.subscriptions FOR SELECT
USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can update workspace subscription"
ON public.subscriptions FOR UPDATE
USING (workspace_id = get_user_workspace_id());

-- Trigger for updated_at
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert trial subscription for existing workspaces
INSERT INTO public.subscriptions (workspace_id, plan_type, trial_ends_at)
SELECT id, 'trial', now() + interval '48 hours'
FROM public.workspaces
ON CONFLICT (workspace_id) DO NOTHING;

-- Modify handle_new_user to also create subscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  
  -- Criar subscription trial
  INSERT INTO public.subscriptions (workspace_id, plan_type, trial_ends_at)
  VALUES (new_workspace_id, 'trial', now() + interval '48 hours');
  
  RETURN new;
END;
$function$;