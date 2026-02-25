-- Create workspace_profiles table
CREATE TABLE IF NOT EXISTS public.workspace_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT,
  description TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(workspace_id)
);

-- Enable RLS
ALTER TABLE public.workspace_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies

-- 1. Users can view workspace profiles if they are a member of the workspace
CREATE POLICY "Users can view their workspace profiles"
  ON public.workspace_profiles
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- 2. Workspace admins/owners can update the workspace profile
CREATE POLICY "Workspace admins can update workspace profiles"
  ON public.workspace_profiles
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );
  
-- 3. Workspace admins/owners can insert the workspace profile
CREATE POLICY "Workspace admins can insert workspace profiles"
  ON public.workspace_profiles
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION public.handle_workspace_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER set_workspace_profiles_updated_at
  BEFORE UPDATE ON public.workspace_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_workspace_profiles_updated_at();

-- Trigger to auto-create a workspace_profile when a workspace is created
CREATE OR REPLACE FUNCTION public.handle_new_workspace_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.workspace_profiles (workspace_id, name)
  VALUES (NEW.id, NEW.name)
  ON CONFLICT (workspace_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: We might want to trigger this on existing workspaces later, or manage it via app logic.
CREATE TRIGGER on_workspace_created_create_profile
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_workspace_profile();

-- Insert backfill for existing workspaces
INSERT INTO public.workspace_profiles (workspace_id, name)
SELECT id, name FROM public.workspaces
ON CONFLICT (workspace_id) DO NOTHING;

-- Storage policies for workspace avatars
-- 1. Anyone can view avatars (they are public)
-- To create the bucket we need a DO block or direct INSERT, using INSERT
INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-avatars', 'workspace-avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'workspace-avatars');

CREATE POLICY "Users can upload workspace avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'workspace-avatars' AND auth.role() = 'authenticated'
  );
  
CREATE POLICY "Users can update workspace avatars"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'workspace-avatars' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete workspace avatars"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'workspace-avatars' AND auth.role() = 'authenticated'
  );
