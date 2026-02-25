-- Adicionar campos para desconto e método de pagamento na tabela subscriptions
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS discount_percent integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS applied_coupon text,
ADD COLUMN IF NOT EXISTS effective_price numeric,
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS card_last_digits text;

-- Atualizar assinaturas existentes com dados do último pagamento confirmado
UPDATE subscriptions s
SET 
  discount_percent = ph.discount_percent,
  applied_coupon = ph.coupon_code,
  effective_price = ph.value,
  payment_method = ph.billing_type
FROM payments_history ph
WHERE s.workspace_id = ph.workspace_id
AND ph.status IN ('CONFIRMED', 'RECEIVED')
AND ph.created_at = (
  SELECT MAX(created_at) FROM payments_history 
  WHERE workspace_id = s.workspace_id AND status IN ('CONFIRMED', 'RECEIVED')
);