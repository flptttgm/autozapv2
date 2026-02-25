-- Mensagens outbound antigas (sem zapi_message_id) = assumir que foram lidas
UPDATE public.messages 
SET delivery_status = 'read'
WHERE direction IN ('outbound', 'outbound_manual')
  AND zapi_message_id IS NULL
  AND delivery_status = 'pending';

-- Mensagens inbound não precisam de indicador de status
UPDATE public.messages 
SET delivery_status = NULL
WHERE direction = 'inbound';