CREATE OR REPLACE FUNCTION public.register_device_token(
p_token TEXT,
p_platform TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
v_user_id UUID;
BEGIN
v_user_id := auth.uid();

IF v_user_id IS NULL THEN
RAISE EXCEPTION 'Authentication required';
END IF;

IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
RAISE EXCEPTION 'Invalid device token';
END IF;

IF p_platform NOT IN ('web', 'android', 'ios') THEN
RAISE EXCEPTION 'Invalid platform';
END IF;

INSERT INTO public.device_tokens (
user_id,
token,
platform
)
VALUES (
v_user_id,
p_token,
p_platform
)
ON CONFLICT (token)
DO UPDATE SET
user_id = EXCLUDED.user_id,
platform = EXCLUDED.platform;
END;
$$;

REVOKE ALL ON FUNCTION public.register_device_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_device_token(TEXT, TEXT) TO authenticated;
