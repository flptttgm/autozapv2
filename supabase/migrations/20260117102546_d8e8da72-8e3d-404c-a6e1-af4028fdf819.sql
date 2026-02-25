-- 1. Corrigir dados existentes: sincronizar créditos com plano real
UPDATE prospect_credits pc
SET 
  monthly_allocation = CASE s.plan_type
    WHEN 'trial' THEN 10
    WHEN 'start' THEN 50
    WHEN 'pro' THEN 200
    WHEN 'business' THEN 500
    ELSE 10
  END,
  balance = CASE s.plan_type
    WHEN 'trial' THEN 10
    WHEN 'start' THEN 50
    WHEN 'pro' THEN 200
    WHEN 'business' THEN 500
    ELSE 10
  END,
  updated_at = now()
FROM subscriptions s
WHERE s.workspace_id = pc.workspace_id;

-- 2. Criar função para sincronizar créditos quando plano mudar
CREATE OR REPLACE FUNCTION sync_prospect_credits_on_plan_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.plan_type IS DISTINCT FROM NEW.plan_type THEN
    UPDATE prospect_credits
    SET 
      monthly_allocation = CASE NEW.plan_type
        WHEN 'trial' THEN 10
        WHEN 'start' THEN 50
        WHEN 'pro' THEN 200
        WHEN 'business' THEN 500
        ELSE 10
      END,
      balance = CASE NEW.plan_type
        WHEN 'trial' THEN 10
        WHEN 'start' THEN 50
        WHEN 'pro' THEN 200
        WHEN 'business' THEN 500
        ELSE 10
      END,
      updated_at = now()
    WHERE workspace_id = NEW.workspace_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Criar trigger para mudança de plano
DROP TRIGGER IF EXISTS on_subscription_plan_change ON subscriptions;
CREATE TRIGGER on_subscription_plan_change
AFTER UPDATE ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION sync_prospect_credits_on_plan_change();

-- 4. Atualizar trigger de criação de workspace para usar plano real
CREATE OR REPLACE FUNCTION on_workspace_created_add_credits()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_type TEXT;
  v_allocation INTEGER;
BEGIN
  -- Buscar plano real do workspace (se existir)
  SELECT plan_type INTO v_plan_type
  FROM subscriptions
  WHERE workspace_id = NEW.id
  LIMIT 1;
  
  -- Definir alocação baseada no plano
  v_allocation := CASE COALESCE(v_plan_type, 'trial')
    WHEN 'trial' THEN 10
    WHEN 'start' THEN 50
    WHEN 'pro' THEN 200
    WHEN 'business' THEN 500
    ELSE 10
  END;
  
  -- Inserir créditos iniciais
  INSERT INTO prospect_credits (workspace_id, balance, monthly_allocation)
  VALUES (NEW.id, v_allocation, v_allocation)
  ON CONFLICT (workspace_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;