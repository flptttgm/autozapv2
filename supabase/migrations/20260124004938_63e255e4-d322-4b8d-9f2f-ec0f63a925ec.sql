-- Criar bucket para documentos do WhatsApp
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-documents', 'whatsapp-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: workspace pode fazer upload na pasta outbound/
CREATE POLICY "Workspaces can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'whatsapp-documents' AND
  (storage.foldername(name))[1] = 'outbound'
);

-- Policy: workspace pode ler seus documentos
CREATE POLICY "Workspaces can read their documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'whatsapp-documents');