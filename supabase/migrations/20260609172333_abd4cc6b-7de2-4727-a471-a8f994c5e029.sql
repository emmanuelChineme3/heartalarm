
-- Conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group BOOLEAN NOT NULL DEFAULT false,
  name TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.conversation_members (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_members_user ON public.conversation_members(user_id);
CREATE INDEX idx_conv_members_conv ON public.conversation_members(conversation_id);
CREATE INDEX idx_messages_conv_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_conversations_last_msg ON public.conversations(last_message_at DESC);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.conversations TO service_role;
GRANT ALL ON public.conversation_members TO service_role;
GRANT ALL ON public.messages TO service_role;

-- Security definer to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conv UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conv AND user_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_creator(_conv UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = _conv AND created_by = _user
  );
$$;

-- RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- conversations: members can read; anyone can create (then add themselves); creator can update
CREATE POLICY conv_select_members ON public.conversations
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));

CREATE POLICY conv_insert_self ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY conv_update_creator ON public.conversations
  FOR UPDATE TO authenticated
  USING (public.is_conversation_member(id, auth.uid()))
  WITH CHECK (public.is_conversation_member(id, auth.uid()));

-- conversation_members: members can read membership; insert self, OR creator can add anyone; users can delete own membership (leave)
CREATE POLICY cm_select_members ON public.conversation_members
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY cm_insert_self_or_creator ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_conversation_creator(conversation_id, auth.uid())
  );

CREATE POLICY cm_update_self ON public.conversation_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY cm_delete_self ON public.conversation_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- messages: members can read; members can send as themselves; sender can delete own
CREATE POLICY msg_select_members ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY msg_insert_member ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

CREATE POLICY msg_delete_own ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- Bump last_message_at on insert
CREATE OR REPLACE FUNCTION public.touch_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_conversation
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_last_message();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
