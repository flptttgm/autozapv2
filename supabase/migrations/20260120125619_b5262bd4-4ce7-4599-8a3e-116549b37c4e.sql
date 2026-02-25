-- Adicionar colunas para rastreamento de status de entrega de mensagens
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS zapi_message_id TEXT;

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';

-- Adicionar constraint check para delivery_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_delivery_status_check'
  ) THEN
    ALTER TABLE public.messages 
    ADD CONSTRAINT messages_delivery_status_check 
    CHECK (delivery_status IN ('pending', 'sent', 'received', 'read', 'played', 'failed'));
  END IF;
END $$;

-- Índice para busca rápida por zapi_message_id (usado pelo webhook para atualizar status)
CREATE INDEX IF NOT EXISTS idx_messages_zapi_message_id 
ON public.messages(zapi_message_id) 
WHERE zapi_message_id IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.messages.zapi_message_id IS 'ID da mensagem retornado pela Z-API para rastreamento de status';
COMMENT ON COLUMN public.messages.delivery_status IS 'Status de entrega: pending, sent, received, read, played, failed';