-- 1. Corrigir mensagens outbound que foram salvas no workspace errado
-- Baseado na instância do WhatsApp que enviou a mensagem
UPDATE messages m
SET workspace_id = wi.workspace_id
FROM whatsapp_instances wi
WHERE (m.metadata->>'instanceId')::text = wi.instance_id
AND m.workspace_id != wi.workspace_id
AND m.direction = 'outbound';

-- 2. Também corrigir leads que podem estar no workspace errado
UPDATE leads l
SET workspace_id = correct_ws.workspace_id
FROM (
  SELECT DISTINCT ON (m.lead_id) m.lead_id, wi.workspace_id
  FROM messages m
  JOIN whatsapp_instances wi ON (m.metadata->>'instanceId')::text = wi.instance_id
  WHERE m.lead_id IS NOT NULL
  ORDER BY m.lead_id, m.created_at DESC
) correct_ws
WHERE l.id = correct_ws.lead_id
AND l.workspace_id != correct_ws.workspace_id;

-- 3. Deletar chat_memory duplicados ANTES de atualizar
-- Remove registros que seriam duplicados após a correção
DELETE FROM chat_memory cm
WHERE EXISTS (
  SELECT 1 FROM (
    SELECT DISTINCT ON (m.chat_id) m.chat_id, wi.workspace_id as correct_workspace
    FROM messages m
    JOIN whatsapp_instances wi ON (m.metadata->>'instanceId')::text = wi.instance_id
    ORDER BY m.chat_id, m.created_at DESC
  ) correct_ws
  WHERE cm.chat_id = correct_ws.chat_id
  AND cm.workspace_id != correct_ws.correct_workspace
  AND EXISTS (
    SELECT 1 FROM chat_memory cm2 
    WHERE cm2.chat_id = correct_ws.chat_id 
    AND cm2.workspace_id = correct_ws.correct_workspace
  )
);

-- 4. Agora atualizar chat_memory restantes para o workspace correto
UPDATE chat_memory cm
SET workspace_id = correct_ws.correct_workspace
FROM (
  SELECT DISTINCT ON (m.chat_id) m.chat_id, wi.workspace_id as correct_workspace
  FROM messages m
  JOIN whatsapp_instances wi ON (m.metadata->>'instanceId')::text = wi.instance_id
  ORDER BY m.chat_id, m.created_at DESC
) correct_ws
WHERE cm.chat_id = correct_ws.chat_id
AND cm.workspace_id != correct_ws.correct_workspace;