
-- 1. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_support boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS border_style text;

-- 2. Extend posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS border_style text;

-- 3. Extend heart_alarms with reveal + virtual sender
ALTER TABLE public.heart_alarms
  ADD COLUMN IF NOT EXISTS virtual_sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reveal_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;

-- Admin can update support profiles (avatar, bio, display_name)
DROP POLICY IF EXISTS "Admins can update support profiles" ON public.profiles;
CREATE POLICY "Admins can update support profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (is_support = true AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (is_support = true AND public.has_role(auth.uid(), 'admin'));

-- Reveal a heart alarm (user must have created a post first, passed as _post_id).
CREATE OR REPLACE FUNCTION public.reveal_heart_alarm(_alarm_id uuid, _post_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  rec public.heart_alarms%ROWTYPE;
  admirer uuid;
  sup_count int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO rec FROM public.heart_alarms WHERE id = _alarm_id;
  IF rec.id IS NULL OR rec.receiver_id <> uid THEN
    RAISE EXCEPTION 'Alarm not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.posts WHERE id = _post_id AND user_id = uid) THEN
    RAISE EXCEPTION 'You must create a post to reveal the admirer';
  END IF;

  admirer := rec.sender_id;
  IF admirer IS NULL THEN
    admirer := rec.virtual_sender_id;
    IF admirer IS NULL THEN
      SELECT COUNT(*) INTO sup_count FROM public.profiles WHERE is_support = true;
      IF sup_count > 0 THEN
        SELECT id INTO admirer FROM public.profiles
          WHERE is_support = true
          ORDER BY md5(id::text || _alarm_id::text)
          LIMIT 1;
        UPDATE public.heart_alarms SET virtual_sender_id = admirer WHERE id = _alarm_id;
      END IF;
    END IF;
  END IF;

  UPDATE public.heart_alarms
     SET revealed_at = now(), reveal_post_id = _post_id
   WHERE id = _alarm_id;
  RETURN admirer;
END; $$;

-- Admin seed support profiles (creates rows directly in public.profiles with random ids; NO auth users).
CREATE OR REPLACE FUNCTION public.admin_seed_support_profiles(_count int DEFAULT 70)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  i int;
  created int := 0;
  new_id uuid;
  base text;
  uname text;
  n int;
  first_names text[] := ARRAY['luna','sage','nova','iris','june','wren','ivy','ash','skye','ember','rio','zara','mika','koa','remi','elle','indie','poe','vale','arlo','juno','maren','saoirse','celeste','nika','ori','lark','sable','ophelia','yumi'];
  last_names  text[] := ARRAY['moon','rose','vibe','wave','glow','heart','soul','echo','mist','flame','fox','luxe','night','dream','sky','ray','story','lush','soft','static'];
  bios text[] := ARRAY[
    'just here for the good vibes 💗',
    'chasing sunsets & soft playlists',
    'making mixtapes for the moon 🌙',
    'wearing my heart on my playlist',
    'catch me daydreaming in pink',
    'plot twist: I noticed you first ✨',
    'romance is a state of mind',
    'sending signals into the night',
    'aesthetic hoarder · pastel enjoyer',
    'writing love letters to strangers'
  ];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR i IN 1.._count LOOP
    new_id := gen_random_uuid();
    base := first_names[1 + floor(random()*array_length(first_names,1))::int]
         || last_names[1 + floor(random()*array_length(last_names,1))::int];
    uname := base;
    n := 0;
    WHILE EXISTS(SELECT 1 FROM public.profiles WHERE username = uname) LOOP
      n := n + 1;
      uname := base || n::text;
    END LOOP;

    INSERT INTO public.profiles (id, username, display_name, bio, is_support, onboarded)
    VALUES (
      new_id,
      uname,
      initcap(replace(uname, '_', ' ')),
      bios[1 + floor(random()*array_length(bios,1))::int],
      true,
      true
    );
    created := created + 1;
  END LOOP;
  RETURN created;
END; $$;

-- Admin edit support profile
CREATE OR REPLACE FUNCTION public.admin_update_support_profile(
  _id uuid, _display_name text, _bio text, _avatar_url text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.profiles
     SET display_name = COALESCE(_display_name, display_name),
         bio = COALESCE(_bio, bio),
         avatar_url = COALESCE(_avatar_url, avatar_url),
         updated_at = now()
   WHERE id = _id AND is_support = true;
END; $$;

-- Admin sends a message impersonating a support profile inside an existing conversation.
CREATE OR REPLACE FUNCTION public.admin_send_support_message(
  _conversation_id uuid, _support_id uuid, _content text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _support_id AND is_support = true) THEN
    RAISE EXCEPTION 'Not a support account';
  END IF;
  INSERT INTO public.conversation_members(conversation_id, user_id)
    VALUES (_conversation_id, _support_id)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.messages(conversation_id, sender_id, content)
    VALUES (_conversation_id, _support_id, _content)
    RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

-- List support profiles (auth only, all users can view)
GRANT EXECUTE ON FUNCTION public.reveal_heart_alarm(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_seed_support_profiles(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_support_profile(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_send_support_message(uuid, uuid, text) TO authenticated;
