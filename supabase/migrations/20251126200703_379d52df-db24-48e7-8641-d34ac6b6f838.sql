-- Add is_read column to messages table
ALTER TABLE public.messages 
ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false;

-- Create index for better query performance
CREATE INDEX idx_messages_is_read ON public.messages(chat_id, is_read, direction) 
WHERE direction = 'inbound';

-- Add comment
COMMENT ON COLUMN public.messages.is_read IS 'Indicates if the message has been read by the recipient';