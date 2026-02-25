-- Add referral columns to workspaces
ALTER TABLE public.workspaces 
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(10) UNIQUE,
ADD COLUMN IF NOT EXISTS referral_balance DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS referred_by_code VARCHAR(10);

-- Create function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code VARCHAR(10);
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code
    new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM workspaces WHERE referral_code = new_code) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  NEW.referral_code := new_code;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate referral code on workspace creation
DROP TRIGGER IF EXISTS set_referral_code ON public.workspaces;
CREATE TRIGGER set_referral_code
  BEFORE INSERT ON public.workspaces
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION public.generate_referral_code();

-- Generate referral codes for existing workspaces that don't have one
UPDATE public.workspaces 
SET referral_code = UPPER(SUBSTRING(MD5(id::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8))
WHERE referral_code IS NULL;

-- Create referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  referred_workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  referral_code VARCHAR(10) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  credit_amount DECIMAL(10,2) DEFAULT 100.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(referred_workspace_id)
);

-- Create referral_credits table for transaction history
CREATE TABLE IF NOT EXISTS public.referral_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  referral_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('earned', 'used', 'expired')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for referrals
CREATE POLICY "Users can view referrals they made" ON public.referrals
  FOR SELECT USING (referrer_workspace_id = get_user_workspace_id());

CREATE POLICY "Platform admins can view all referrals" ON public.referrals
  FOR SELECT USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage referrals" ON public.referrals
  FOR ALL USING (is_platform_admin(auth.uid()));

-- RLS Policies for referral_credits
CREATE POLICY "Users can view own credits" ON public.referral_credits
  FOR SELECT USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Platform admins can view all credits" ON public.referral_credits
  FOR SELECT USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage credits" ON public.referral_credits
  FOR ALL USING (is_platform_admin(auth.uid()));

-- Function to credit referrer when payment is confirmed
CREATE OR REPLACE FUNCTION public.credit_referrer(
  _referred_workspace_id UUID,
  _credit_amount DECIMAL DEFAULT 100.00
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referral RECORD;
  _referrer_workspace_id UUID;
BEGIN
  -- Find the pending referral for this workspace
  SELECT * INTO _referral 
  FROM referrals 
  WHERE referred_workspace_id = _referred_workspace_id 
    AND status = 'pending'
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  _referrer_workspace_id := _referral.referrer_workspace_id;
  
  -- Update referral status to completed
  UPDATE referrals 
  SET status = 'completed', completed_at = NOW()
  WHERE id = _referral.id;
  
  -- Add credit to referrer's balance
  UPDATE workspaces 
  SET referral_balance = COALESCE(referral_balance, 0) + _credit_amount
  WHERE id = _referrer_workspace_id;
  
  -- Record the credit transaction
  INSERT INTO referral_credits (workspace_id, amount, referral_id, type, description)
  VALUES (
    _referrer_workspace_id, 
    _credit_amount, 
    _referral.id, 
    'earned',
    'Indicação concluída - novo assinante'
  );
  
  RETURN TRUE;
END;
$$;

-- Function to get referral stats for a workspace
CREATE OR REPLACE FUNCTION public.get_referral_stats(_workspace_id UUID)
RETURNS TABLE(
  total_referrals BIGINT,
  completed_referrals BIGINT,
  pending_referrals BIGINT,
  total_earned DECIMAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*) as total_referrals,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_referrals,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_referrals,
    COALESCE(SUM(credit_amount) FILTER (WHERE status = 'completed'), 0) as total_earned
  FROM referrals
  WHERE referrer_workspace_id = _workspace_id;
$$;