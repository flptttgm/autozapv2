-- Tabela de triggers configuráveis
CREATE TABLE public.whatsapp_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'account_created', 
    'trial_expired', 
    'lead_inactive', 
    'whatsapp_connected',
    'subscription_activated'
  )),
  conditions JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vincular templates a triggers
ALTER TABLE public.whatsapp_message_templates 
ADD COLUMN trigger_id UUID REFERENCES whatsapp_triggers(id) ON DELETE SET NULL;

-- Índice para busca rápida
CREATE INDEX idx_triggers_enabled_type ON whatsapp_triggers(enabled, trigger_type);

-- RLS para platform admins
ALTER TABLE whatsapp_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage triggers"
ON whatsapp_triggers FOR ALL
USING (public.is_platform_admin(auth.uid()));

-- Migrar triggers existentes (dados padrão)
INSERT INTO whatsapp_triggers (name, description, trigger_type, conditions) VALUES
('Conta nova sem WhatsApp', 'Dispara quando uma conta é criada mas não conecta o WhatsApp em 5-60 minutos', 'account_created', '{"min_age_minutes": 5, "max_age_minutes": 60, "requires_no_whatsapp": true}'),
('Trial expirado', 'Dispara quando o período de teste expira', 'trial_expired', '{"notify_immediately": true}'),
('Lead inativo 7 dias', 'Dispara quando um lead fica sem atividade por 7 dias', 'lead_inactive', '{"inactive_days": 7}'),
('WhatsApp conectado', 'Dispara quando o usuário conecta o WhatsApp', 'whatsapp_connected', '{"min_delay_minutes": 1}');

-- Vincular templates existentes aos triggers
UPDATE whatsapp_message_templates 
SET trigger_id = (SELECT id FROM whatsapp_triggers WHERE trigger_type = 'account_created')
WHERE message_type = 'not_connected';

UPDATE whatsapp_message_templates 
SET trigger_id = (SELECT id FROM whatsapp_triggers WHERE trigger_type = 'trial_expired')
WHERE message_type = 'trial_expired';

UPDATE whatsapp_message_templates 
SET trigger_id = (SELECT id FROM whatsapp_triggers WHERE trigger_type = 'whatsapp_connected')
WHERE message_type IN ('just_connected', 'connected_alone');