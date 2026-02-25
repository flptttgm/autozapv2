-- Enable REPLICA IDENTITY FULL for messages table
-- This allows realtime UPDATE events to include the old values in payload.old
-- Required for comparing metadata.transcription changes
ALTER TABLE public.messages REPLICA IDENTITY FULL;