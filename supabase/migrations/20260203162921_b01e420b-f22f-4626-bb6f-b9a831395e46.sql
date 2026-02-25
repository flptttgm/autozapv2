-- Adicionar campos de mídia na tabela whatsapp_message_templates
ALTER TABLE public.whatsapp_message_templates
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('image', 'video')),
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false;

-- Comentários para documentação
COMMENT ON COLUMN whatsapp_message_templates.media_url IS 'URL pública da imagem ou vídeo no storage';
COMMENT ON COLUMN whatsapp_message_templates.media_type IS 'Tipo de mídia: image ou video';
COMMENT ON COLUMN whatsapp_message_templates.is_custom IS 'Se true, template foi criado pelo admin (pode ser deletado)';

-- Criar bucket público para templates de mídia
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-template-media', 'whatsapp-template-media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS para o bucket - apenas platform admins podem fazer upload
CREATE POLICY "Platform admins can upload template media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'whatsapp-template-media' 
  AND public.is_platform_admin(auth.uid())
);

-- RLS para deletar - apenas platform admins
CREATE POLICY "Platform admins can delete template media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'whatsapp-template-media' 
  AND public.is_platform_admin(auth.uid())
);

-- RLS para visualizar - público (Z-API precisa acessar)
CREATE POLICY "Anyone can view template media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-template-media');

-- RLS para update - apenas platform admins
CREATE POLICY "Platform admins can update template media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'whatsapp-template-media' AND public.is_platform_admin(auth.uid()))
WITH CHECK (bucket_id = 'whatsapp-template-media' AND public.is_platform_admin(auth.uid()));