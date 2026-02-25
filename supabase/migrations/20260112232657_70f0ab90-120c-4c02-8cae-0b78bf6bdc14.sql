-- Tabela para armazenar alertas de erros de autenticação
CREATE TABLE public.auth_error_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  error_message TEXT,
  error_code TEXT,
  user_email TEXT,
  stack_trace TEXT,
  metadata JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX idx_auth_error_alerts_type ON auth_error_alerts(error_type);
CREATE INDEX idx_auth_error_alerts_created ON auth_error_alerts(created_at DESC);
CREATE INDEX idx_auth_error_alerts_resolved ON auth_error_alerts(resolved) WHERE resolved = false;

-- Habilitar RLS (apenas service role pode acessar)
ALTER TABLE auth_error_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: platform admins podem ver via função RPC
CREATE POLICY "Platform admins can view auth errors"
  ON auth_error_alerts FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

-- Tabela para registrar admins que recebem alertas
CREATE TABLE public.admin_alert_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  notification_types TEXT[] DEFAULT ARRAY['auth_errors', 'critical_alerts'],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE admin_alert_recipients ENABLE ROW LEVEL SECURITY;

-- Policy: platform admins podem gerenciar
CREATE POLICY "Platform admins can manage alert recipients"
  ON admin_alert_recipients FOR ALL
  USING (public.is_platform_admin(auth.uid()));

-- Inserir admins existentes automaticamente
INSERT INTO public.admin_alert_recipients (user_id, email, notification_types)
SELECT 
  ur.user_id,
  u.email,
  ARRAY['auth_errors', 'critical_alerts']
FROM user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role = 'platform_admin'
ON CONFLICT (user_id) DO NOTHING;