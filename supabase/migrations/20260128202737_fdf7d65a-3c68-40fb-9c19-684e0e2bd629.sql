-- Tabela de debug traces para rastreamento de cadeias de eventos
CREATE TABLE IF NOT EXISTS public.debug_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id uuid NOT NULL,
  parent_event_id uuid REFERENCES public.debug_traces(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL DEFAULT 1,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  event_type text NOT NULL,
  event_name text NOT NULL,
  status text NOT NULL,
  input_payload jsonb,
  output_payload jsonb,
  expected_output jsonb,
  error_message text,
  duration_ms integer,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_debug_traces_trace_id ON public.debug_traces(trace_id);
CREATE INDEX idx_debug_traces_parent ON public.debug_traces(parent_event_id);
CREATE INDEX idx_debug_traces_workspace_created ON public.debug_traces(workspace_id, created_at DESC);
CREATE INDEX idx_debug_traces_function_created ON public.debug_traces(function_name, created_at DESC);
CREATE INDEX idx_debug_traces_status_error ON public.debug_traces(status) WHERE status = 'error';
CREATE INDEX idx_debug_traces_created_at ON public.debug_traces(created_at DESC);

-- RLS: Apenas platform admins podem ver e gerenciar
ALTER TABLE public.debug_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view debug traces"
  ON public.debug_traces FOR SELECT
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert debug traces"
  ON public.debug_traces FOR INSERT
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete debug traces"
  ON public.debug_traces FOR DELETE
  USING (is_platform_admin(auth.uid()));

-- Permitir service role inserir (para edge functions)
CREATE POLICY "Service role can insert debug traces"
  ON public.debug_traces FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can select debug traces"
  ON public.debug_traces FOR SELECT
  USING (auth.role() = 'service_role');