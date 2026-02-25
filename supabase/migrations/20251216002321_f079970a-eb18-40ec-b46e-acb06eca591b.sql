-- Add ai_paused column to chat_memory table for Hands On feature
ALTER TABLE public.chat_memory ADD COLUMN ai_paused boolean NOT NULL DEFAULT false;