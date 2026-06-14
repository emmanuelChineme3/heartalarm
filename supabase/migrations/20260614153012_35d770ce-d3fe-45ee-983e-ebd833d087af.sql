
-- 1) Table
CREATE TABLE public.heart_alarms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','auto')),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX heart_alarms_receiver_idx ON public.heart_alarms(receiver_id, created_at DESC);
CREATE INDEX heart_alarms_sender_idx ON public.heart_alarms(sender_id, receiver_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.heart_alarms TO authenticated;
GRANT ALL ON public.heart_alarms TO service_role;

ALTER TABLE public.heart_alarms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own alarms (received or sent)"
  ON public.heart_alarms FOR SELECT TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

CREATE POLICY "send own alarms"
  ON public.heart_alarms FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND sender_id <> receiver_id);

CREATE POLICY "receiver marks read"
  ON public.heart_alarms FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id) WITH CHECK (auth.uid() = receiver_id);

-- 2) Manual send RPC
CREATE OR REPLACE FUNCTION public.send_heart_alarm(_post_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  owner uuid;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT user_id INTO owner FROM public.posts WHERE id = _post_id;
  IF owner IS NULL THEN RAISE EXCEPTION 'Post not found'; END IF;
  IF owner = uid THEN RAISE EXCEPTION 'Cannot heart-alarm yourself'; END IF;

  INSERT INTO public.heart_alarms (sender_id, receiver_id, post_id, kind)
  VALUES (uid, owner, _post_id, 'manual')
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- 3) Auto trigger on likes
CREATE OR REPLACE FUNCTION public.maybe_trigger_heart_alarm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  receiver uuid;
  distinct_posts int;
  recent_auto int;
BEGIN
  SELECT user_id INTO receiver FROM public.posts WHERE id = NEW.post_id;
  IF receiver IS NULL OR receiver = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COUNT(DISTINCT l.post_id) INTO distinct_posts
    FROM public.likes l
    JOIN public.posts p ON p.id = l.post_id
   WHERE l.user_id = NEW.user_id AND p.user_id = receiver;

  IF distinct_posts < 3 THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO recent_auto
    FROM public.heart_alarms
   WHERE sender_id = NEW.user_id
     AND receiver_id = receiver
     AND kind = 'auto'
     AND created_at > now() - interval '7 days';

  IF recent_auto = 0 THEN
    INSERT INTO public.heart_alarms (sender_id, receiver_id, post_id, kind)
    VALUES (NEW.user_id, receiver, NEW.post_id, 'auto');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maybe_trigger_heart_alarm ON public.likes;
CREATE TRIGGER trg_maybe_trigger_heart_alarm
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.maybe_trigger_heart_alarm();

-- 4) Mark read RPC
CREATE OR REPLACE FUNCTION public.mark_heart_alarms_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.heart_alarms
     SET read_at = now()
   WHERE receiver_id = auth.uid() AND read_at IS NULL;
END;
$$;

-- 5) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.heart_alarms;
