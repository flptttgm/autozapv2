-- Add processed_at column to message_buffer for debugging and lock tracking
ALTER TABLE public.message_buffer 
ADD COLUMN IF NOT EXISTS processed_at timestamp with time zone DEFAULT NULL;