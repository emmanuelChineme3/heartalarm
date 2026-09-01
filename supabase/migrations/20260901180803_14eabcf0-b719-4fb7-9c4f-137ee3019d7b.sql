ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
CREATE INDEX IF NOT EXISTS profiles_phone_idx ON public.profiles (phone);

CREATE TABLE IF NOT EXISTS public.ring_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(9), 'hex'),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name text,
  message text,
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.ring_links TO authenticated;
GRANT ALL ON public.ring_links TO service_role;

ALTER TABLE public.ring_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Senders manage their ring links"
ON public.ring_links FOR SELECT TO authenticated
USING (sender_id = auth.uid() OR claimed_by = auth.uid());

CREATE POLICY "Users create their own ring links"
ON public.ring_links FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_ring_links_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_ring_links_updated_at
BEFORE UPDATE ON public.ring_links
FOR EACH ROW EXECUTE FUNCTION public.touch_ring_links_updated_at();

-- Normalize a phone number to its last 9 digits for contact matching.
CREATE OR REPLACE FUNCTION public.normalize_phone(_p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(right(regexp_replace(COALESCE(_p, ''), '[^0-9]', '', 'g'), 9), '');
$$;

-- Which of these phone numbers belong to Heart Alarm users?
CREATE OR REPLACE FUNCTION public.match_contacts(_phones text[])
RETURNS TABLE (phone text, user_id uuid, username text, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (n.p) n.p, pr.id, pr.username, pr.display_name, pr.avatar_url
  FROM unnest(_phones) AS raw(v)
  CROSS JOIN LATERAL (SELECT public.normalize_phone(raw.v) AS p) n
  JOIN public.profiles pr ON public.normalize_phone(pr.phone) = n.p
  WHERE auth.uid() IS NOT NULL AND n.p IS NOT NULL AND pr.id <> auth.uid();
$$;

-- Ring a Heart Alarm user directly (no post), reusing the 3/day quota.
CREATE OR REPLACE FUNCTION public.ring_user(_receiver uuid, _local_date date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
  used_count int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _local_date IS NULL THEN _local_date := current_date; END IF;
  IF _receiver IS NULL THEN RAISE EXCEPTION 'Receiver required'; END IF;
  IF _receiver = uid THEN RAISE EXCEPTION 'Cannot heart-alarm yourself'; END IF;

  INSERT INTO public.heart_ring_quota (user_id, ring_date, used)
  VALUES (uid, _local_date, 0)
  ON CONFLICT (user_id, ring_date) DO NOTHING;

  SELECT used INTO used_count FROM public.heart_ring_quota
   WHERE user_id = uid AND ring_date = _local_date FOR UPDATE;

  IF used_count >= 3 THEN
    RAISE EXCEPTION 'DAILY_RING_LIMIT';
  END IF;

  INSERT INTO public.heart_alarms (sender_id, receiver_id, kind)
  VALUES (uid, _receiver, 'manual')
  RETURNING id INTO new_id;

  UPDATE public.heart_ring_quota
     SET used = used + 1, updated_at = now()
   WHERE user_id = uid AND ring_date = _local_date;

  RETURN new_id;
END;
$$;

-- Create a shareable ring link for a contact who isn't on Heart Alarm yet.
CREATE OR REPLACE FUNCTION public.create_ring_link(_contact_name text, _message text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  t text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.ring_links (sender_id, contact_name, message)
  VALUES (uid, NULLIF(_contact_name, ''), NULLIF(_message, ''))
  RETURNING token INTO t;
  RETURN t;
END;
$$;

-- Public: open a shared ring link (no account needed).
CREATE OR REPLACE FUNCTION public.get_ring_link(_token text)
RETURNS TABLE (
  token text,
  contact_name text,
  message text,
  sender_display_name text,
  sender_username text,
  sender_avatar_url text,
  claimed boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ring_links SET opened_at = COALESCE(opened_at, now())
   WHERE ring_links.token = _token;

  RETURN QUERY
  SELECT rl.token, rl.contact_name, rl.message,
         COALESCE(p.display_name, p.username), p.username, p.avatar_url,
         rl.claimed_by IS NOT NULL, rl.created_at
  FROM public.ring_links rl
  JOIN public.profiles p ON p.id = rl.sender_id
  WHERE rl.token = _token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ring_link(text) TO anon, authenticated;

-- After joining, connect the new user to the ring that brought them in.
CREATE OR REPLACE FUNCTION public.claim_ring_link(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rl public.ring_links%ROWTYPE;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO rl FROM public.ring_links WHERE token = _token;
  IF rl.id IS NULL OR rl.claimed_by IS NOT NULL OR rl.sender_id = uid THEN
    RETURN NULL;
  END IF;

  UPDATE public.ring_links
     SET claimed_by = uid, claimed_at = now()
   WHERE id = rl.id;

  INSERT INTO public.heart_alarms (sender_id, receiver_id, kind)
  VALUES (rl.sender_id, uid, 'manual')
  RETURNING id INTO new_id;

  INSERT INTO public.follows (follower_id, following_id)
  VALUES (rl.sender_id, uid)
  ON CONFLICT DO NOTHING;

  RETURN new_id;
END;
$$;