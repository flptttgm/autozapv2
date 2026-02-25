-- Tabela de campanhas
CREATE TABLE public.whatsapp_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL DEFAULT '5fa32d2a-d6cf-42de-aa4c-d0964098ac8d',
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video')),
  audience_type TEXT NOT NULL CHECK (audience_type IN ('leads', 'csv')),
  audience_filters JSONB DEFAULT '{}',
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'completed', 'failed', 'cancelled')),
  stats JSONB DEFAULT '{"total": 0, "sent": 0, "failed": 0}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de recipients
CREATE TABLE public.whatsapp_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  lead_id UUID REFERENCES leads(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_campaigns_status_scheduled ON whatsapp_campaigns(status, scheduled_at);
CREATE INDEX idx_recipients_campaign_status ON whatsapp_campaign_recipients(campaign_id, status);

-- RLS para platform admins
ALTER TABLE whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage campaigns"
ON whatsapp_campaigns FOR ALL
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage recipients"
ON whatsapp_campaign_recipients FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM whatsapp_campaigns c 
    WHERE c.id = campaign_id 
    AND public.is_platform_admin(auth.uid())
  )
);