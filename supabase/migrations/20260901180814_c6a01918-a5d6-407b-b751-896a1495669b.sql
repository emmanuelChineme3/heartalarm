CREATE OR REPLACE FUNCTION public.normalize_phone(_p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(right(regexp_replace(COALESCE(_p, ''), '[^0-9]', '', 'g'), 9), '');
$$;