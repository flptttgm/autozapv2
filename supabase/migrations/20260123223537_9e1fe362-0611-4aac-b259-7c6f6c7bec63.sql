-- Create bucket for outbound WhatsApp audio (private; served via signed URLs)
insert into storage.buckets (id, name, public)
values ('whatsapp-audio', 'whatsapp-audio', false)
on conflict (id) do nothing;