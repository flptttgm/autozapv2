-- Create composite index for faster message queries by workspace
CREATE INDEX IF NOT EXISTS idx_messages_workspace_created 
ON messages(workspace_id, created_at DESC);

-- Create index for unread messages lookup
CREATE INDEX IF NOT EXISTS idx_messages_unread 
ON messages(workspace_id, direction, is_read) 
WHERE direction = 'inbound' AND is_read = false;

-- Create index for chat_memory lookup
CREATE INDEX IF NOT EXISTS idx_chat_memory_workspace 
ON chat_memory(workspace_id, chat_id);