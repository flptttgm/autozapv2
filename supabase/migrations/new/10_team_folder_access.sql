-- ============================================
-- 10. Team Folder Access Control + Chat Folders
-- ============================================

-- 1. MEMBER_FOLDER_ACCESS (links workspace_members to lead_folders)
CREATE TABLE IF NOT EXISTS public.member_folder_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES public.lead_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, folder_id)
);

ALTER TABLE public.member_folder_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage member_folder_access in their workspace"
  ON public.member_folder_access FOR ALL
  USING (
    member_id IN (
      SELECT wm.id FROM workspace_members wm
      JOIN profiles p ON p.workspace_id = wm.workspace_id
      WHERE p.id = auth.uid()
    )
  );

CREATE INDEX idx_member_folder_access_member ON public.member_folder_access(member_id);
CREATE INDEX idx_member_folder_access_folder ON public.member_folder_access(folder_id);

-- 2. CHAT_FOLDERS (folders for conversations)
CREATE TABLE IF NOT EXISTS public.chat_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  chat_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, name)
);

ALTER TABLE public.chat_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage chat_folders in their workspace"
  ON public.chat_folders FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

-- 3. MEMBER_CHAT_FOLDER_ACCESS (links workspace_members to chat_folders)
CREATE TABLE IF NOT EXISTS public.member_chat_folder_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES public.chat_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, folder_id)
);

ALTER TABLE public.member_chat_folder_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage member_chat_folder_access in their workspace"
  ON public.member_chat_folder_access FOR ALL
  USING (
    member_id IN (
      SELECT wm.id FROM workspace_members wm
      JOIN profiles p ON p.workspace_id = wm.workspace_id
      WHERE p.id = auth.uid()
    )
  );

CREATE INDEX idx_member_chat_folder_access_member ON public.member_chat_folder_access(member_id);
CREATE INDEX idx_member_chat_folder_access_folder ON public.member_chat_folder_access(folder_id);

-- 4. Add folder_id to chat_memory for conversation folders
ALTER TABLE public.chat_memory ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.chat_folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_chat_memory_folder ON public.chat_memory(folder_id);

-- 5. Trigger to update chat_folder count
CREATE OR REPLACE FUNCTION update_chat_folder_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.folder_id IS NOT NULL THEN
      UPDATE chat_folders
      SET chat_count = (SELECT COUNT(*) FROM chat_memory WHERE folder_id = OLD.folder_id),
          updated_at = now()
      WHERE id = OLD.folder_id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.folder_id IS NOT NULL THEN
      UPDATE chat_folders
      SET chat_count = (SELECT COUNT(*) FROM chat_memory WHERE folder_id = NEW.folder_id),
          updated_at = now()
      WHERE id = NEW.folder_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.folder_id IS DISTINCT FROM NEW.folder_id THEN
      IF OLD.folder_id IS NOT NULL THEN
        UPDATE chat_folders
        SET chat_count = (SELECT COUNT(*) FROM chat_memory WHERE folder_id = OLD.folder_id),
            updated_at = now()
        WHERE id = OLD.folder_id;
      END IF;
      IF NEW.folder_id IS NOT NULL THEN
        UPDATE chat_folders
        SET chat_count = (SELECT COUNT(*) FROM chat_memory WHERE folder_id = NEW.folder_id),
            updated_at = now()
        WHERE id = NEW.folder_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_chat_folder_count
AFTER INSERT OR UPDATE OR DELETE ON chat_memory
FOR EACH ROW EXECUTE FUNCTION update_chat_folder_count();

SELECT 'Team folder access control setup complete!' as result;
