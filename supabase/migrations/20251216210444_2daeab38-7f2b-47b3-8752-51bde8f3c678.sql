-- Create table for custom magic link tokens
CREATE TABLE public.magic_link_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.magic_link_tokens ENABLE ROW LEVEL SECURITY;

-- Allow inserting tokens (public access for the edge function)
CREATE POLICY "Allow insert magic link tokens" 
ON public.magic_link_tokens 
FOR INSERT 
WITH CHECK (true);

-- Allow selecting tokens for verification
CREATE POLICY "Allow select magic link tokens" 
ON public.magic_link_tokens 
FOR SELECT 
USING (true);

-- Allow updating tokens (mark as used)
CREATE POLICY "Allow update magic link tokens" 
ON public.magic_link_tokens 
FOR UPDATE 
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_magic_link_tokens_token ON public.magic_link_tokens(token);
CREATE INDEX idx_magic_link_tokens_email ON public.magic_link_tokens(email);