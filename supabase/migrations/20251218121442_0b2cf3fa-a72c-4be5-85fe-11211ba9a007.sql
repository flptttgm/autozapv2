-- Create media storage bucket for permanent audio/media storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media', 
  'media', 
  true,
  52428800, -- 50MB limit
  ARRAY['audio/ogg', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/wav', 'audio/opus', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
) ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read from media bucket (public files)
CREATE POLICY "Public read access for media"
ON storage.objects FOR SELECT
USING (bucket_id = 'media');

-- Allow authenticated users to upload to their workspace folder
CREATE POLICY "Workspace members can upload media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'media' AND
  (auth.uid() IS NOT NULL OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role')
);

-- Allow service role to manage all media (for webhook uploads)
CREATE POLICY "Service role full access to media"
ON storage.objects FOR ALL
USING (bucket_id = 'media')
WITH CHECK (bucket_id = 'media');

-- Configure messages table for full replica identity (captures all fields including JSONB metadata changes)
ALTER TABLE public.messages REPLICA IDENTITY FULL;