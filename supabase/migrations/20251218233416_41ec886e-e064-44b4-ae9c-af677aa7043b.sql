-- Adicionar coluna ai_template_id para vincular template de IA específico por instância
ALTER TABLE public.whatsapp_instances 
ADD COLUMN ai_template_id UUID REFERENCES public.custom_templates(id) ON DELETE SET NULL;

-- Adicionar coluna display_name para nome amigável da instância
ALTER TABLE public.whatsapp_instances 
ADD COLUMN display_name VARCHAR(100);

-- Criar índice para busca por ai_template_id
CREATE INDEX idx_whatsapp_instances_ai_template_id ON public.whatsapp_instances(ai_template_id);

-- Comentário explicativo
COMMENT ON COLUMN public.whatsapp_instances.ai_template_id IS 'Template de IA customizado para esta instância. Se NULL, usa as configurações globais do workspace.';
COMMENT ON COLUMN public.whatsapp_instances.display_name IS 'Nome amigável da instância (ex: Suporte, Vendas, Atendimento)';