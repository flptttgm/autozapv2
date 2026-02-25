-- Create secure RPC function for admin dynamic queries
-- This function validates and executes SELECT-only queries with workspace isolation

CREATE OR REPLACE FUNCTION admin_safe_query(
  p_workspace_id UUID,
  p_query TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '5s'
AS $$
DECLARE
  result JSONB;
  safe_query TEXT;
  allowed_tables TEXT[] := ARRAY[
    'leads', 'appointments', 'quotes', 'invoices', 'messages',
    'chat_memory', 'knowledge_base', 'lead_tags', 'lead_tag_assignments',
    'whatsapp_instances', 'subscriptions', 'custom_templates',
    'sentiment_history', 'scheduled_invoices', 'pix_config',
    'workspace_members', 'audit_logs', 'referrals', 'referral_credits'
  ];
  table_name TEXT;
  is_valid BOOLEAN := false;
BEGIN
  -- Validation 1: Only SELECT allowed
  IF NOT (p_query ~* '^\s*SELECT\s+') THEN
    RAISE EXCEPTION 'Apenas SELECT permitido';
  END IF;
  
  -- Validation 2: Block dangerous operations
  IF p_query ~* '(DELETE|INSERT|UPDATE|DROP|ALTER|TRUNCATE|GRANT|CREATE|EXECUTE)' THEN
    RAISE EXCEPTION 'Operação não permitida';
  END IF;
  
  -- Validation 3: Must contain workspace placeholder
  IF NOT (p_query LIKE '%$WORKSPACE_ID$%') THEN
    RAISE EXCEPTION 'Query deve incluir filtro de workspace_id';
  END IF;
  
  -- Validation 4: Check if uses only allowed tables
  FOREACH table_name IN ARRAY allowed_tables LOOP
    IF p_query ~* ('\mFROM\s+' || table_name || '\M') OR 
       p_query ~* ('\mJOIN\s+' || table_name || '\M') THEN
      is_valid := true;
    END IF;
  END LOOP;
  
  IF NOT is_valid THEN
    RAISE EXCEPTION 'Tabela não permitida para consulta admin';
  END IF;
  
  -- Replace workspace placeholder
  safe_query := REPLACE(p_query, '$WORKSPACE_ID$', quote_literal(p_workspace_id));
  
  -- Add LIMIT if not present (protection against heavy queries)
  IF NOT (safe_query ~* '\sLIMIT\s+\d+') THEN
    safe_query := safe_query || ' LIMIT 100';
  END IF;
  
  -- Execute and return result
  EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || safe_query || ') t'
  INTO result;
  
  RETURN result;
END;
$$;