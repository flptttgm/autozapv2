-- Tabela de configurações de automações de email
CREATE TABLE email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  enabled boolean DEFAULT true,
  delay_hours integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de templates de email personalizáveis
CREATE TABLE email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES email_automations(id) ON DELETE CASCADE,
  subject text NOT NULL,
  html_content text NOT NULL,
  variables text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de logs de emails enviados
CREATE TABLE email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES email_automations(id),
  user_id uuid NOT NULL,
  email text NOT NULL,
  trigger_type text NOT NULL,
  status text DEFAULT 'sent',
  error_message text,
  sent_at timestamptz DEFAULT now(),
  sent_date date DEFAULT CURRENT_DATE
);

-- Índice para evitar duplicatas (um email por trigger por usuário por dia)
CREATE UNIQUE INDEX email_logs_unique_daily 
ON email_logs (user_id, trigger_type, sent_date);

-- Enable RLS
ALTER TABLE email_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_automations (apenas platform admins)
CREATE POLICY "Platform admins can view email_automations"
ON email_automations FOR SELECT
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert email_automations"
ON email_automations FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update email_automations"
ON email_automations FOR UPDATE
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete email_automations"
ON email_automations FOR DELETE
USING (is_platform_admin(auth.uid()));

-- RLS policies for email_templates
CREATE POLICY "Platform admins can view email_templates"
ON email_templates FOR SELECT
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert email_templates"
ON email_templates FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update email_templates"
ON email_templates FOR UPDATE
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete email_templates"
ON email_templates FOR DELETE
USING (is_platform_admin(auth.uid()));

-- RLS policies for email_logs
CREATE POLICY "Platform admins can view email_logs"
ON email_logs FOR SELECT
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert email_logs"
ON email_logs FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()));

-- Inserir automações padrão
INSERT INTO email_automations (trigger_type, name, description, enabled) VALUES
  ('trial_24h', 'Trial - 24 horas restantes', 'Enviado quando faltam 24h para o trial expirar', true),
  ('trial_6h', 'Trial - 6 horas restantes', 'Enviado quando faltam 6h para o trial expirar', true),
  ('trial_expired', 'Trial - Expirado', 'Enviado quando o trial expirou', true),
  ('welcome', 'Boas-vindas', 'Enviado após cadastro do usuário', false),
  ('inactivity_7d', 'Inatividade - 7 dias', 'Enviado após 7 dias sem atividade', false);

-- Inserir templates padrão para cada automação
INSERT INTO email_templates (automation_id, subject, html_content, variables)
SELECT 
  id,
  CASE trigger_type
    WHEN 'trial_24h' THEN 'Seu trial termina em 24 horas ⏰'
    WHEN 'trial_6h' THEN 'Últimas 6 horas do seu trial! ⚡'
    WHEN 'trial_expired' THEN 'Seu período de teste expirou 😢'
    WHEN 'welcome' THEN 'Bem-vindo ao Autozap! 🎉'
    WHEN 'inactivity_7d' THEN 'Sentimos sua falta no Autozap 👋'
  END,
  CASE trigger_type
    WHEN 'trial_24h' THEN '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden;"><div style="background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); padding: 30px; text-align: center;"><img src="https://autozap.com.br/logo-white.png" alt="Autozap" style="height: 40px;" /></div><div style="padding: 30px;"><h1 style="color: #1f2937; margin: 0 0 20px;">Olá {{user_name}}!</h1><p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px;">Seu período de teste no <strong>Autozap</strong> termina em <strong>24 horas</strong>.</p><p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px;">Não perca acesso às automações que você já configurou! Escolha um plano e continue automatizando seu atendimento.</p><div style="text-align: center;"><a href="{{plan_url}}" style="display: inline-block; background: #7c3aed; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Ver Planos</a></div></div><div style="background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af;"><p>© 2025 Autozap. Todos os direitos reservados.</p></div></div>'
    WHEN 'trial_6h' THEN '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden;"><div style="background: linear-gradient(135deg, #dc2626 0%, #f87171 100%); padding: 30px; text-align: center;"><img src="https://autozap.com.br/logo-white.png" alt="Autozap" style="height: 40px;" /></div><div style="padding: 30px;"><h1 style="color: #1f2937; margin: 0 0 20px;">⚡ Últimas horas, {{user_name}}!</h1><p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px;">Seu período de teste termina em <strong>apenas 6 horas</strong>!</p><p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px;">Garanta seu acesso agora e continue automatizando seu WhatsApp com inteligência artificial.</p><div style="text-align: center;"><a href="{{plan_url}}" style="display: inline-block; background: #dc2626; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Escolher Plano Agora</a></div></div><div style="background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af;"><p>© 2025 Autozap. Todos os direitos reservados.</p></div></div>'
    WHEN 'trial_expired' THEN '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden;"><div style="background: linear-gradient(135deg, #1f2937 0%, #4b5563 100%); padding: 30px; text-align: center;"><img src="https://autozap.com.br/logo-white.png" alt="Autozap" style="height: 40px;" /></div><div style="padding: 30px;"><h1 style="color: #1f2937; margin: 0 0 20px;">Olá {{user_name}},</h1><p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px;">Seu período de teste no <strong>Autozap</strong> expirou.</p><p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px;">Mas não se preocupe! <strong>Seus dados ainda estão salvos</strong> e você pode reativar sua conta a qualquer momento.</p><p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px;">Escolha um plano e volte a automatizar seu atendimento no WhatsApp!</p><div style="text-align: center;"><a href="{{plan_url}}" style="display: inline-block; background: #7c3aed; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Reativar Minha Conta</a></div></div><div style="background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af;"><p>© 2025 Autozap. Todos os direitos reservados.</p></div></div>'
    WHEN 'welcome' THEN '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden;"><div style="background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); padding: 30px; text-align: center;"><img src="https://autozap.com.br/logo-white.png" alt="Autozap" style="height: 40px;" /></div><div style="padding: 30px;"><h1 style="color: #1f2937; margin: 0 0 20px;">🎉 Bem-vindo ao Autozap, {{user_name}}!</h1><p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px;">Seu período de teste de <strong>48 horas</strong> já começou!</p><p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px;">Conecte seu WhatsApp e comece a automatizar seu atendimento com inteligência artificial agora mesmo.</p><div style="text-align: center;"><a href="{{app_url}}" style="display: inline-block; background: #7c3aed; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Começar Configuração</a></div></div><div style="background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af;"><p>© 2025 Autozap. Todos os direitos reservados.</p></div></div>'
    WHEN 'inactivity_7d' THEN '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden;"><div style="background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); padding: 30px; text-align: center;"><img src="https://autozap.com.br/logo-white.png" alt="Autozap" style="height: 40px;" /></div><div style="padding: 30px;"><h1 style="color: #1f2937; margin: 0 0 20px;">👋 Sentimos sua falta, {{user_name}}!</h1><p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px;">Faz uma semana que você não acessa o Autozap.</p><p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px;">Sua IA está pronta para atender seus clientes 24/7. Que tal dar uma olhada nas conversas?</p><div style="text-align: center;"><a href="{{app_url}}" style="display: inline-block; background: #7c3aed; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Acessar Minha Conta</a></div></div><div style="background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af;"><p>© 2025 Autozap. Todos os direitos reservados.</p></div></div>'
  END,
  ARRAY['{{user_name}}', '{{plan_url}}', '{{app_url}}']
FROM email_automations;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_email_automations_updated_at
BEFORE UPDATE ON email_automations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON email_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();