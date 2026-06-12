-- ============================================================
-- MIGRATION: Add chat_id to messages
-- ============================================================

-- First, ensure the public.messages table exists (in case it is missing or needs setup)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add column chat_id referencing chats with CASCADE delete
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE;

-- Create an index on chat_id
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages (chat_id);
