-- Update handle_new_user to process referral codes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id uuid;
  ref_code text;
  referrer_ws_id uuid;
BEGIN
  -- Get referral code from user metadata if present
  ref_code := new.raw_user_meta_data ->> 'referral_code';
  
  -- Criar workspace pessoal
  INSERT INTO public.workspaces (name, owner_id, referred_by_code)
  VALUES (
    COALESCE(new.raw_user_meta_data ->> 'full_name', 'Meu Workspace'),
    new.id,
    ref_code
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
  
  -- Process referral if code is present
  IF ref_code IS NOT NULL AND ref_code != '' THEN
    -- Find the referrer workspace
    SELECT id INTO referrer_ws_id 
    FROM workspaces 
    WHERE referral_code = ref_code
    LIMIT 1;
    
    IF referrer_ws_id IS NOT NULL THEN
      -- Create pending referral record
      INSERT INTO public.referrals (
        referrer_workspace_id,
        referred_workspace_id,
        referral_code,
        status,
        credit_amount
      ) VALUES (
        referrer_ws_id,
        new_workspace_id,
        ref_code,
        'pending',
        100.00
      );
      
      RAISE LOG '[referral] Created pending referral for workspace % from referrer %', new_workspace_id, referrer_ws_id;
    END IF;
  END IF;
  
  RETURN new;
END;
$$;