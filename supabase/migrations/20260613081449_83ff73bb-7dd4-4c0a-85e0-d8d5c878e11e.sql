
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS code text;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_code_unique ON public.conversations (code) WHERE code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.gen_conversation_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i int;
  attempts int := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(alphabet, 1 + floor(random()*length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.conversations WHERE code = result);
    attempts := attempts + 1;
    IF attempts > 20 THEN EXIT; END IF;
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_conversation_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.is_group AND NEW.code IS NULL THEN
    NEW.code := public.gen_conversation_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_conversation_code ON public.conversations;
CREATE TRIGGER trg_set_conversation_code
BEFORE INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.set_conversation_code();

-- Backfill codes for existing groups
UPDATE public.conversations SET code = public.gen_conversation_code() WHERE is_group = true AND code IS NULL;

-- Join by short code
CREATE OR REPLACE FUNCTION public.join_conversation_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  uid uuid := auth.uid();
  conv uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO conv FROM public.conversations WHERE code = upper(_code) AND is_group = true;
  IF conv IS NULL THEN RAISE EXCEPTION 'Invalid code'; END IF;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (conv, uid) ON CONFLICT DO NOTHING;
  RETURN conv;
END;
$$;

-- Creator-only: remove a member
CREATE OR REPLACE FUNCTION public.remove_conversation_member(_conv uuid, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_conversation_creator(_conv, uid) THEN
    RAISE EXCEPTION 'Only the group creator can remove members';
  END IF;
  IF _user = uid THEN RAISE EXCEPTION 'Creator cannot remove themselves'; END IF;
  DELETE FROM public.conversation_members WHERE conversation_id = _conv AND user_id = _user;
END;
$$;

-- Creator-only: update details
CREATE OR REPLACE FUNCTION public.update_conversation_details(_conv uuid, _name text, _description text, _avatar_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_conversation_creator(_conv, uid) THEN
    RAISE EXCEPTION 'Only the creator can update this group';
  END IF;
  UPDATE public.conversations
     SET name = COALESCE(_name, name),
         description = COALESCE(_description, description),
         avatar_url = COALESCE(_avatar_url, avatar_url)
   WHERE id = _conv;
END;
$$;

-- Creator-only: delete group
CREATE OR REPLACE FUNCTION public.delete_conversation(_conv uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_conversation_creator(_conv, uid) THEN
    RAISE EXCEPTION 'Only the creator can delete this group';
  END IF;
  DELETE FROM public.messages WHERE conversation_id = _conv;
  DELETE FROM public.conversation_invites WHERE conversation_id = _conv;
  DELETE FROM public.conversation_members WHERE conversation_id = _conv;
  DELETE FROM public.conversations WHERE id = _conv;
END;
$$;
