-- Create message_buffer table for accumulating fragmented messages
CREATE TABLE public.message_buffer (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id VARCHAR NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  buffer_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_processed BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 seconds'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_message_buffer_chat_id ON public.message_buffer(chat_id);
CREATE INDEX idx_message_buffer_expires_at ON public.message_buffer(expires_at);
CREATE INDEX idx_message_buffer_is_processed ON public.message_buffer(is_processed);

-- Enable RLS
ALTER TABLE public.message_buffer ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_buffer (allow all for backend processing)
CREATE POLICY "Enable all operations on message_buffer"
  ON public.message_buffer
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create chat_memory table for AI conversation context
CREATE TABLE public.chat_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id VARCHAR NOT NULL UNIQUE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  conversation_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  context_summary TEXT,
  last_interaction TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_chat_memory_chat_id ON public.chat_memory(chat_id);
CREATE INDEX idx_chat_memory_lead_id ON public.chat_memory(lead_id);
CREATE INDEX idx_chat_memory_last_interaction ON public.chat_memory(last_interaction);

-- Enable RLS
ALTER TABLE public.chat_memory ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_memory (allow all for backend processing)
CREATE POLICY "Enable all operations on chat_memory"
  ON public.chat_memory
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create calendar_integrations table (optional Google Calendar integration)
CREATE TABLE public.calendar_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  provider VARCHAR NOT NULL DEFAULT 'google',
  credentials JSONB NOT NULL,
  calendar_id VARCHAR,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index
CREATE INDEX idx_calendar_integrations_lead_id ON public.calendar_integrations(lead_id);
CREATE INDEX idx_calendar_integrations_is_active ON public.calendar_integrations(is_active);

-- Enable RLS
ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies for calendar_integrations
CREATE POLICY "Enable all operations on calendar_integrations"
  ON public.calendar_integrations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at on chat_memory
CREATE TRIGGER update_chat_memory_updated_at
  BEFORE UPDATE ON public.chat_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to update updated_at on calendar_integrations
CREATE TRIGGER update_calendar_integrations_updated_at
  BEFORE UPDATE ON public.calendar_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();