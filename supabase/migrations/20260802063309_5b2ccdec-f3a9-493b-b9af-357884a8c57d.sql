CREATE TABLE IF NOT EXISTS public.heart_ring_quota (
  user_id uuid NOT NULL,
  ring_date date NOT NULL,
  used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ring_date)
);

GRANT SELECT, INSERT, UPDATE ON public.heart_ring_quota TO authenticated;
GRANT ALL ON public.heart_ring_quota TO service_role;

ALTER TABLE public.heart_ring_quota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own ring quota select" ON public.heart_ring_quota
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own ring quota insert" ON public.heart_ring_quota
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own ring quota update" ON public.heart_ring_quota
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.rings_left_today(_local_date date)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT GREATEST(0, 3 - COALESCE((
    SELECT used FROM public.heart_ring_quota
    WHERE user_id = auth.uid() AND ring_date = _local_date
  ), 0));
$$;

DROP FUNCTION IF EXISTS public.send_heart_alarm(uuid);

CREATE OR REPLACE FUNCTION public.send_heart_alarm(_post_id uuid, _local_date date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  owner uuid;
  new_id uuid;
  used_count int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _local_date IS NULL THEN _local_date := current_date; END IF;

  SELECT user_id INTO owner FROM public.posts WHERE id = _post_id;
  IF owner IS NULL THEN RAISE EXCEPTION 'Post not found'; END IF;
  IF owner = uid THEN RAISE EXCEPTION 'Cannot heart-alarm yourself'; END IF;

  INSERT INTO public.heart_ring_quota (user_id, ring_date, used)
  VALUES (uid, _local_date, 0)
  ON CONFLICT (user_id, ring_date) DO NOTHING;

  SELECT used INTO used_count FROM public.heart_ring_quota
   WHERE user_id = uid AND ring_date = _local_date FOR UPDATE;

  IF used_count >= 3 THEN
    RAISE EXCEPTION 'DAILY_RING_LIMIT';
  END IF;

  INSERT INTO public.heart_alarms (sender_id, receiver_id, post_id, kind)
  VALUES (uid, owner, _post_id, 'manual')
  RETURNING id INTO new_id;

  UPDATE public.heart_ring_quota
     SET used = used + 1, updated_at = now()
   WHERE user_id = uid AND ring_date = _local_date;

  RETURN new_id;
END;
$$;