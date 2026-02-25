-- Create enum for lead status
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost');

-- Create enum for appointment status
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled');

-- Create leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255),
  email VARCHAR(255),
  status lead_status DEFAULT 'new',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create appointments table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  google_calendar_event_id VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status appointment_status DEFAULT 'scheduled',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table for conversation history
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  chat_id VARCHAR(255) NOT NULL,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('text', 'audio', 'image', 'document')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create system_config table for storing configuration
CREATE TABLE public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_leads_phone ON public.leads(phone);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_appointments_lead_id ON public.appointments(lead_id);
CREATE INDEX idx_appointments_start_time ON public.appointments(start_time);
CREATE INDEX idx_messages_lead_id ON public.messages(lead_id);
CREATE INDEX idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a backend automation system)
-- In production, you should restrict these based on your authentication requirements

CREATE POLICY "Enable all operations on leads" ON public.leads
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations on appointments" ON public.appointments
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations on messages" ON public.messages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable read on system_config" ON public.system_config
  FOR SELECT USING (true);

CREATE POLICY "Enable insert on system_config" ON public.system_config
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update on system_config" ON public.system_config
  FOR UPDATE USING (true) WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at
  BEFORE UPDATE ON public.system_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default system configuration
INSERT INTO public.system_config (config_key, config_value, description) VALUES
  ('business_hours', '{"start": "08:00", "end": "18:00", "timezone": "America/Sao_Paulo", "weekdays_only": true}', 'Business hours configuration'),
  ('ai_prompt', '{"system_prompt": "Você é um assistente virtual atencioso que ajuda a agendar consultas e responder dúvidas. Seja educado, profissional e eficiente."}', 'AI system prompt configuration'),
  ('message_buffer_timeout', '{"timeout_seconds": 30}', 'Time to wait for message fragments'),
  ('webhook_config', '{"enabled": true}', 'Webhook configuration');
