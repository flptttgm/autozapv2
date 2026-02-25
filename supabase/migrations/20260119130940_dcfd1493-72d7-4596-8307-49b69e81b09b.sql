-- 1. Atualizar função de sync na mudança de plano
CREATE OR REPLACE FUNCTION sync_prospect_credits_on_plan_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.plan_type IS DISTINCT FROM NEW.plan_type THEN
    UPDATE prospect_credits
    SET 
      monthly_allocation = CASE NEW.plan_type
        WHEN 'trial' THEN 10
        WHEN 'start' THEN 50
        WHEN 'pro' THEN 80
        WHEN 'business' THEN 100
        ELSE 10
      END,
      balance = CASE NEW.plan_type
        WHEN 'trial' THEN 10
        WHEN 'start' THEN 50
        WHEN 'pro' THEN 80
        WHEN 'business' THEN 100
        ELSE 10
      END,
      updated_at = now()
    WHERE workspace_id = NEW.workspace_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Atualizar função de criação de workspace
CREATE OR REPLACE FUNCTION on_workspace_created_add_credits()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_type TEXT;
  v_allocation INTEGER;
BEGIN
  SELECT plan_type INTO v_plan_type
  FROM subscriptions
  WHERE workspace_id = NEW.id
  LIMIT 1;
  
  v_allocation := CASE COALESCE(v_plan_type, 'trial')
    WHEN 'trial' THEN 10
    WHEN 'start' THEN 50
    WHEN 'pro' THEN 80
    WHEN 'business' THEN 100
    ELSE 10
  END;
  
  INSERT INTO prospect_credits (workspace_id, balance, monthly_allocation)
  VALUES (NEW.id, v_allocation, v_allocation)
  ON CONFLICT (workspace_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Atualizar workspaces existentes com valores incorretos
UPDATE prospect_credits pc
SET 
  monthly_allocation = CASE s.plan_type
    WHEN 'trial' THEN 10
    WHEN 'start' THEN 50
    WHEN 'pro' THEN 80
    WHEN 'business' THEN 100
    ELSE 10
  END
FROM subscriptions s
WHERE pc.workspace_id = s.workspace_id
AND pc.monthly_allocation NOT IN (10, 50, 80, 100);