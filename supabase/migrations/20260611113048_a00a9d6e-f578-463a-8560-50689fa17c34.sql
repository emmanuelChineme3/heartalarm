
-- Allow any current member to add another user to a conversation
CREATE OR REPLACE FUNCTION public.add_conversation_member(_conv uuid, _user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_conversation_member(_conv, uid) THEN
    RAISE EXCEPTION 'Not a member';
  END IF;
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (_conv, _user)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Invite tokens for groups
CREATE TABLE public.conversation_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_invites TO authenticated;
GRANT ALL ON public.conversation_invites TO service_role;

ALTER TABLE public.conversation_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view invites"
ON public.conversation_invites FOR SELECT TO authenticated
USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "members can create invites"
ON public.conversation_invites FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.is_conversation_member(conversation_id, auth.uid())
);

CREATE POLICY "creator can delete invite"
ON public.conversation_invites FOR DELETE TO authenticated
USING (created_by = auth.uid());

-- Create or reuse an invite token for a conversation
CREATE OR REPLACE FUNCTION public.create_conversation_invite(_conv uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  tok text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_conversation_member(_conv, uid) THEN
    RAISE EXCEPTION 'Not a member';
  END IF;

  SELECT token INTO tok FROM public.conversation_invites
   WHERE conversation_id = _conv AND created_by = uid
     AND (expires_at IS NULL OR expires_at > now())
   ORDER BY created_at DESC LIMIT 1;

  IF tok IS NOT NULL THEN RETURN tok; END IF;

  tok := encode(gen_random_bytes(12), 'base64');
  tok := replace(replace(replace(tok, '/', ''), '+', ''), '=', '');

  INSERT INTO public.conversation_invites (conversation_id, token, created_by)
  VALUES (_conv, tok, uid);

  RETURN tok;
END;
$$;

-- Join a conversation using an invite token; returns the conversation id
CREATE OR REPLACE FUNCTION public.join_conversation_by_token(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  conv uuid;
  exp timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT conversation_id, expires_at INTO conv, exp
    FROM public.conversation_invites WHERE token = _token;
  IF conv IS NULL THEN RAISE EXCEPTION 'Invalid invite'; END IF;
  IF exp IS NOT NULL AND exp < now() THEN RAISE EXCEPTION 'Invite expired'; END IF;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (conv, uid)
  ON CONFLICT DO NOTHING;

  RETURN conv;
END;
$$;
