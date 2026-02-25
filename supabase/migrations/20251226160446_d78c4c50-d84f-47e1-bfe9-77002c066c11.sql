-- Atualizar tabela user_coupons com campos extras
ALTER TABLE user_coupons
ADD COLUMN IF NOT EXISTS min_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS current_uses INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_universal BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments_history(id);

-- Adicionar campos de cupom na tabela payments_history
ALTER TABLE payments_history
ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS discount_percent INTEGER,
ADD COLUMN IF NOT EXISTS original_value NUMERIC,
ADD COLUMN IF NOT EXISTS discount_value NUMERIC;