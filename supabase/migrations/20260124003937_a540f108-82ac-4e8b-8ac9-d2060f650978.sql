-- Create bucket for WhatsApp images
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-images', 'whatsapp-images', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: Authenticated users can upload to outbound folder
CREATE POLICY "Users can upload outbound images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'whatsapp-images' AND
  (storage.foldername(name))[1] = 'outbound'
);

-- RLS policy: Authenticated users can read images
CREATE POLICY "Users can read images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'whatsapp-images');

-- RLS policy: Service role can manage all images
CREATE POLICY "Service role can manage images"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'whatsapp-images')
WITH CHECK (bucket_id = 'whatsapp-images');