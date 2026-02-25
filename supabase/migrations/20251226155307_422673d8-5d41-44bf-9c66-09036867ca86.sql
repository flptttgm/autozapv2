-- Criar tabela para cupons únicos
CREATE TABLE public.user_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  code VARCHAR(20) UNIQUE NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 20,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Platform admins can manage coupons"
ON public.user_coupons FOR ALL
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Workspace owners can view own coupons"
ON public.user_coupons FOR SELECT
USING (workspace_id = public.get_user_workspace_id());

-- Criar automação de reativação (DESATIVADA por padrão)
INSERT INTO public.email_automations (
  trigger_type, 
  name, 
  description, 
  enabled, 
  delay_hours,
  max_sends_per_user,
  min_hours_between_sends
) VALUES (
  'reactivation_coupon',
  'Cupom de Reativação',
  'Oferece 20% de desconto para trials inativos via WhatsApp. Usuário precisa enviar mensagem para receber o cupom.',
  false,
  0,
  NULL,
  168
);

-- Criar template do email
INSERT INTO public.email_templates (automation_id, subject, html_content, variables)
SELECT 
  id,
  '🎁 Cupom especial de 20% OFF esperando por você!',
  '<p>Olá {{user_name}},</p>
<p>Notamos que você ainda não aproveitou todo o potencial do AutoZap!</p>
<p>Para te ajudar a voltar, temos um presente especial:</p>
<p style="font-size: 18px; font-weight: bold;">🎟️ CUPOM DE 20% DE DESCONTO</p>
<p>Para resgatar seu cupom exclusivo, clique no botão abaixo e envie a mensagem - nosso time vai te responder na hora!</p>
<p style="text-align: center; margin: 24px 0;">
  <a href="https://wa.me/5565963126825?text=Ol%C3%A1%2C%20eu%20quero%20o%20cupom%20de%20desconto%20do%20Autozap" 
     style="background-color: #25D366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
    💬 Quero meu cupom de 20%!
  </a>
</p>
<p>Se tiver qualquer dúvida sobre como usar a plataforma, aproveite e pergunte na mesma conversa!</p>
<p>Abraços,<br>Equipe AutoZap</p>',
  ARRAY['user_name']::text[]
FROM public.email_automations WHERE trigger_type = 'reactivation_coupon';