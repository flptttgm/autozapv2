-- Adicionar campo para rastrear origem do cadastro na tabela referrals
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'standard';
-- Valores: 'standard' (link normal) | 'custom' (link personalizado com skip_onboarding)

-- Adicionar campo para rastrear redirecionamento
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS redirect_path TEXT;

-- Adicionar campo para rastrear origem na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_source VARCHAR(50) DEFAULT 'organic';
-- Valores: 'organic' | 'referral_standard' | 'referral_custom'

-- Adicionar campo para rastrear origem na tabela workspaces
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS signup_source VARCHAR(50) DEFAULT 'organic';

-- Atualizar a função handle_new_user para incluir os novos campos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_workspace_id uuid;
  ref_code text;
  referrer_ws_id uuid;
  signup_src text;
  redirect_path_val text;
  skip_onboard boolean;
BEGIN
  -- Get data from user metadata
  ref_code := new.raw_user_meta_data ->> 'referral_code';
  skip_onboard := COALESCE((new.raw_user_meta_data ->> 'skip_onboarding')::boolean, false);
  redirect_path_val := new.raw_user_meta_data ->> 'redirect_after_auth';
  
  -- Determinar signup_source baseado nos dados
  IF ref_code IS NOT NULL AND ref_code != '' THEN
    IF skip_onboard THEN
      signup_src := 'referral_custom';
    ELSE
      signup_src := 'referral_standard';
    END IF;
  ELSE
    signup_src := 'organic';
  END IF;
  
  -- Criar workspace pessoal
  INSERT INTO public.workspaces (name, owner_id, referred_by_code, signup_source)
  VALUES (
    COALESCE(new.raw_user_meta_data ->> 'full_name', 'Meu Workspace'),
    new.id,
    ref_code,
    signup_src
  )
  RETURNING id INTO new_workspace_id;
  
  -- Criar profile vinculado ao workspace com signup_source
  INSERT INTO public.profiles (id, full_name, workspace_id, signup_source)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new_workspace_id,
    signup_src
  );
  
  -- Adicionar usuário como owner do workspace
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, new.id, 'owner');
  
  -- Criar subscription trial
  INSERT INTO public.subscriptions (workspace_id, plan_type, trial_ends_at)
  VALUES (new_workspace_id, 'trial', now() + interval '48 hours');
  
  -- Process referral if code is present
  IF ref_code IS NOT NULL AND ref_code != '' THEN
    -- Find the referrer workspace
    SELECT id INTO referrer_ws_id 
    FROM workspaces 
    WHERE referral_code = ref_code
    LIMIT 1;
    
    IF referrer_ws_id IS NOT NULL THEN
      -- Create pending referral record with source tracking
      INSERT INTO public.referrals (
        referrer_workspace_id,
        referred_workspace_id,
        referral_code,
        status,
        credit_amount,
        source,
        redirect_path
      ) VALUES (
        referrer_ws_id,
        new_workspace_id,
        ref_code,
        'pending',
        100.00,
        CASE WHEN skip_onboard THEN 'custom' ELSE 'standard' END,
        redirect_path_val
      );
      
      RAISE LOG '[referral] Created pending referral for workspace % from referrer % with source %', 
        new_workspace_id, referrer_ws_id, CASE WHEN skip_onboard THEN 'custom' ELSE 'standard' END;
    END IF;
  END IF;
  
  RETURN new;
END;
$$;