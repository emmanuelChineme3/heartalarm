
-- Make sender_id nullable so support-filled alarms don't need a real sender.
ALTER TABLE public.heart_alarms ALTER COLUMN sender_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_min_heart_alarms(_target int DEFAULT 1)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  existing int;
  needed int;
  i int;
  sup uuid;
  sup_count int;
BEGIN
  IF uid IS NULL THEN RETURN 0; END IF;
  IF _target < 1 THEN _target := 1; END IF;
  IF _target > 10 THEN _target := 10; END IF;

  SELECT COUNT(*) INTO existing FROM public.heart_alarms WHERE receiver_id = uid;
  needed := _target - existing;
  IF needed <= 0 THEN RETURN 0; END IF;

  SELECT COUNT(*) INTO sup_count FROM public.profiles WHERE is_support = true;
  IF sup_count = 0 THEN RETURN 0; END IF;

  FOR i IN 1..needed LOOP
    SELECT id INTO sup FROM public.profiles
      WHERE is_support = true AND id <> uid
      ORDER BY random() LIMIT 1;
    INSERT INTO public.heart_alarms (sender_id, receiver_id, post_id, kind, virtual_sender_id)
    VALUES (NULL, uid, NULL, 'auto', sup);
  END LOOP;
  RETURN needed;
END; $$;

GRANT EXECUTE ON FUNCTION public.ensure_min_heart_alarms(int) TO authenticated;
