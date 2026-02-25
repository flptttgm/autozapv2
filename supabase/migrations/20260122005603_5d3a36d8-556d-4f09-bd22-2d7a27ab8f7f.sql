-- Create table for WhatsApp message templates
CREATE TABLE public.whatsapp_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_type TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_message_templates ENABLE ROW LEVEL SECURITY;

-- Only platform admins can manage templates
CREATE POLICY "Platform admins can view templates"
ON public.whatsapp_message_templates
FOR SELECT
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert templates"
ON public.whatsapp_message_templates
FOR INSERT
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update templates"
ON public.whatsapp_message_templates
FOR UPDATE
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete templates"
ON public.whatsapp_message_templates
FOR DELETE
USING (public.is_platform_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_message_templates_updated_at
BEFORE UPDATE ON public.whatsapp_message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO public.whatsapp_message_templates (message_type, name, description, content, enabled) VALUES
('not_connected', 'Usuário não conectou', 'Enviado quando usuário cria conta mas não conecta WhatsApp em 24h', 'Oi{userName}! Sou do time de suporte do {a}AutoZap.

Criei esse contato pra te ajudar a configurar tudo certinho por aqui.

Vi que você criou sua conta, mas ainda não conectou o WhatsApp. Quer uma mãozinha? 🙋

Se preferir fazer sozinho, é só seguir o passo a passo dentro do app. Mas qualquer dúvida, me chama aqui!', true),

('just_connected', 'Acabou de conectar', 'Enviado manualmente após conexão', 'Boa{userName}! Vi que você conectou o WhatsApp. 🎉

Agora falta só configurar sua IA — é rapidinho, prometo!

Precisa de ajuda com isso?', true),

('connected_alone', 'Conectou sozinho', 'Enviado automaticamente quando usuário conecta sem assistência', 'Oi{userName}! Sou do time de suporte do {a}AutoZap.

Criei esse contato pra te ajudar com qualquer dúvida que aparecer.

Vi que você já conectou seu WhatsApp — boa! Agora, se precisar de ajuda pra:

• Configurar sua IA
• Configurar horários de atendimento
• Ajustar respostas automáticas

Como posso te ajudar?', true),

('trial_expired', 'Trial expirado', 'Enviado quando o período de teste termina', 'Oi{userName}! Aqui é do time do {a}AutoZap novamente.

Vi que seu período de teste terminou. 😔

Me conta: o que aconteceu? Ficou alguma dúvida sobre como usar a plataforma?

Às vezes é só um ajuste na configuração que faz toda a diferença. Se quiser, posso te ajudar a resolver qualquer ponto que ficou pendente.

E se não for o momento certo, sem problemas! Só me conta o que te travou, assim consigo melhorar a experiência para outros usuários também.', true);