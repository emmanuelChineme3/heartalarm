
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tour_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS welcome_ring_at timestamptz;

CREATE OR REPLACE FUNCTION public.start_welcome_ring()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _already timestamptz;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;
  SELECT welcome_ring_at INTO _already FROM public.profiles WHERE id = _uid;
  IF _already IS NOT NULL THEN RETURN NULL; END IF;

  INSERT INTO public.heart_alarms (receiver_id, kind)
  VALUES (_uid, 'welcome')
  RETURNING id INTO _id;

  UPDATE public.profiles SET welcome_ring_at = now() WHERE id = _uid;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_tour()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles SET tour_done = true WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.start_welcome_ring() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_tour() TO authenticated;
