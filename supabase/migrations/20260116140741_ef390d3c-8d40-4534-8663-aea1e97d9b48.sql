-- Table to store workspace prospect credit balances
CREATE TABLE public.prospect_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  monthly_allocation INTEGER NOT NULL DEFAULT 0,
  last_monthly_reset TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

-- Enable RLS
ALTER TABLE public.prospect_credits ENABLE ROW LEVEL SECURITY;

-- Users can view their workspace credits
CREATE POLICY "Users can view own workspace credits"
  ON public.prospect_credits FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Table to log all credit transactions
CREATE TABLE public.prospect_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  balance_after INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prospect_credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their workspace transactions
CREATE POLICY "Users can view own workspace transactions"
  ON public.prospect_credit_transactions FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Table to track phone reveal requests (async webhook flow)
CREATE TABLE public.apollo_phone_reveals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  apollo_person_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  phone_raw TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  payload JSONB,
  UNIQUE(workspace_id, apollo_person_id)
);

-- Enable RLS
ALTER TABLE public.apollo_phone_reveals ENABLE ROW LEVEL SECURITY;

-- Users can view their workspace phone reveals
CREATE POLICY "Users can view own workspace phone reveals"
  ON public.apollo_phone_reveals FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Function to debit prospect credits atomically
CREATE OR REPLACE FUNCTION public.debit_prospect_credits(
  p_workspace_id UUID,
  p_amount INTEGER,
  p_action TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Update balance and get new value
  UPDATE public.prospect_credits
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE workspace_id = p_workspace_id
    AND balance >= p_amount
  RETURNING balance INTO v_new_balance;
  
  -- Check if update happened (sufficient balance)
  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;
  
  -- Log the transaction
  INSERT INTO public.prospect_credit_transactions (
    workspace_id, amount, action, description, balance_after, metadata
  ) VALUES (
    p_workspace_id, -p_amount, p_action, p_description, v_new_balance, p_metadata
  );
  
  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to add prospect credits
CREATE OR REPLACE FUNCTION public.add_prospect_credits(
  p_workspace_id UUID,
  p_amount INTEGER,
  p_action TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Upsert credit record and add balance
  INSERT INTO public.prospect_credits (workspace_id, balance, monthly_allocation)
  VALUES (p_workspace_id, p_amount, 0)
  ON CONFLICT (workspace_id) DO UPDATE
  SET balance = prospect_credits.balance + p_amount,
      updated_at = now()
  RETURNING balance INTO v_new_balance;
  
  -- Log the transaction
  INSERT INTO public.prospect_credit_transactions (
    workspace_id, amount, action, description, balance_after, metadata
  ) VALUES (
    p_workspace_id, p_amount, p_action, p_description, v_new_balance, p_metadata
  );
  
  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create prospect_credits when workspace is created
CREATE OR REPLACE FUNCTION public.create_prospect_credits_for_workspace()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.prospect_credits (workspace_id, balance, monthly_allocation)
  VALUES (NEW.id, 10, 10); -- Start with 10 trial credits
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_workspace_created_add_credits
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.create_prospect_credits_for_workspace();

-- Add credits for existing workspaces
INSERT INTO public.prospect_credits (workspace_id, balance, monthly_allocation)
SELECT id, 10, 10 FROM public.workspaces
ON CONFLICT (workspace_id) DO NOTHING;