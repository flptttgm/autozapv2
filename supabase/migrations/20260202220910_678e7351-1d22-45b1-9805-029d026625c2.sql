-- Create table for admin phone numbers
CREATE TABLE public.workspace_admin_phones (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, user_id)
);

-- Create index for fast phone lookups (critical for message processing)
CREATE INDEX idx_workspace_admin_phones_phone ON public.workspace_admin_phones(phone);
CREATE INDEX idx_workspace_admin_phones_workspace ON public.workspace_admin_phones(workspace_id);

-- Enable RLS
ALTER TABLE public.workspace_admin_phones ENABLE ROW LEVEL SECURITY;

-- Create helper function to check workspace membership (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE user_id = _user_id AND workspace_id = _workspace_id
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = _user_id AND workspace_id = _workspace_id
    )
$$;

-- RLS Policy: Users can only see their own admin phone record
CREATE POLICY "Users can view their own admin phone"
ON public.workspace_admin_phones
FOR SELECT
USING (user_id = auth.uid());

-- RLS Policy: Users can insert their own admin phone if they're a workspace member
CREATE POLICY "Users can insert their own admin phone"
ON public.workspace_admin_phones
FOR INSERT
WITH CHECK (
    user_id = auth.uid() 
    AND public.is_workspace_member(auth.uid(), workspace_id)
);

-- RLS Policy: Users can update their own admin phone
CREATE POLICY "Users can update their own admin phone"
ON public.workspace_admin_phones
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can delete their own admin phone
CREATE POLICY "Users can delete their own admin phone"
ON public.workspace_admin_phones
FOR DELETE
USING (user_id = auth.uid());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_workspace_admin_phones_updated_at
BEFORE UPDATE ON public.workspace_admin_phones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();