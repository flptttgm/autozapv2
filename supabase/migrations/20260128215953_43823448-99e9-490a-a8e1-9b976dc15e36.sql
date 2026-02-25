-- Função para buscar workspace pelo email do usuário (apenas admins)
CREATE OR REPLACE FUNCTION public.get_workspace_by_email(user_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_id uuid;
BEGIN
  -- Verificar se é platform admin
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: only platform admins can use this function';
  END IF;
  
  -- Buscar workspace do usuário pelo email
  SELECT wm.workspace_id INTO ws_id
  FROM auth.users au
  JOIN public.workspace_members wm ON wm.user_id = au.id
  WHERE LOWER(au.email) = LOWER(user_email)
  ORDER BY wm.created_at DESC
  LIMIT 1;
  
  RETURN ws_id;
END;
$$;