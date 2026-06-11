
CREATE OR REPLACE FUNCTION public.create_conversation(
  _is_group boolean,
  _name text,
  _member_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  uid uuid := auth.uid();
  m uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.conversations (is_group, name, created_by)
  VALUES (_is_group, _name, uid)
  RETURNING id INTO new_id;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (new_id, uid)
  ON CONFLICT DO NOTHING;

  IF _member_ids IS NOT NULL THEN
    FOREACH m IN ARRAY _member_ids LOOP
      IF m <> uid THEN
        INSERT INTO public.conversation_members (conversation_id, user_id)
        VALUES (new_id, m)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_conversation(boolean, text, uuid[]) TO authenticated;
