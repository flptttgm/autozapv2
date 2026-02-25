-- Adicionar coluna para rastrear instanceId desde o webhook
ALTER TABLE public.message_buffer 
ADD COLUMN IF NOT EXISTS instance_id VARCHAR(255);

-- Índice para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_message_buffer_instance_id 
ON public.message_buffer(instance_id);

-- Comentário para documentação
COMMENT ON COLUMN public.message_buffer.instance_id IS 
  'ID da instância WhatsApp que recebeu a mensagem (propaga para process-message)';