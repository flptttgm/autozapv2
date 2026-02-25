-- 1. Remover constraint antiga (chat_id only)
ALTER TABLE chat_memory DROP CONSTRAINT IF EXISTS chat_memory_chat_id_key;

-- 2. Criar nova constraint com workspace_id para isolamento correto
ALTER TABLE chat_memory ADD CONSTRAINT chat_memory_chat_id_workspace_unique 
  UNIQUE(chat_id, workspace_id);

-- 3. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_chat_memory_workspace_id 
  ON chat_memory(workspace_id);

-- 4. Criar registros de chat_memory faltando para workspaces que estavam usando o errado
INSERT INTO chat_memory (chat_id, workspace_id, conversation_history, ai_paused)
SELECT DISTINCT m.chat_id, m.workspace_id, '[]'::jsonb, false
FROM messages m
LEFT JOIN chat_memory cm ON cm.chat_id = m.chat_id AND cm.workspace_id = m.workspace_id
WHERE cm.id IS NULL
AND m.workspace_id IS NOT NULL
ON CONFLICT DO NOTHING;