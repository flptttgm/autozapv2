-- Criar índice único parcial na coluna zapi_message_id
-- Isso garante que não haja duplicatas no nível do banco de dados
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_zapi_message_id_unique 
ON public.messages (zapi_message_id) 
WHERE zapi_message_id IS NOT NULL;