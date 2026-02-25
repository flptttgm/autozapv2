-- Atualizar valor default na tabela referrals de R$100 para R$50
ALTER TABLE referrals 
ALTER COLUMN credit_amount SET DEFAULT 50.00;

-- Atualizar função credit_referrer para usar novo valor default de R$50
CREATE OR REPLACE FUNCTION public.credit_referrer(
  _referred_workspace_id UUID,
  _credit_amount DECIMAL DEFAULT 50.00
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_workspace_id UUID;
  referral_rec RECORD;
BEGIN
  -- Find the pending referral and get referrer workspace
  SELECT r.id, r.referrer_workspace_id INTO referral_rec
  FROM referrals r
  WHERE r.referred_workspace_id = _referred_workspace_id
    AND r.status = 'pending'
  LIMIT 1;
  
  IF referral_rec IS NULL THEN
    RETURN FALSE;
  END IF;
  
  referrer_workspace_id := referral_rec.referrer_workspace_id;
  
  -- Update the referral to completed
  UPDATE referrals
  SET status = 'completed',
      completed_at = NOW(),
      credit_amount = _credit_amount
  WHERE id = referral_rec.id;
  
  -- Add credit to referrer's balance
  UPDATE workspaces
  SET referral_balance = COALESCE(referral_balance, 0) + _credit_amount
  WHERE id = referrer_workspace_id;
  
  -- Insert credit record
  INSERT INTO referral_credits (workspace_id, referral_id, amount, type, description)
  VALUES (referrer_workspace_id, referral_rec.id, _credit_amount, 'referral', 'Bônus por indicação convertida');
  
  RETURN TRUE;
END;
$$;