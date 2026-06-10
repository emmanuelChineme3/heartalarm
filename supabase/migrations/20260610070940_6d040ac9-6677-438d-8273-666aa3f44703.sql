ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonus_comments INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 0;
  total_users INT;
  bonus_f INT := 0;
  bonus_l INT := 0;
  bonus_c INT := 0;
BEGIN
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );
  base_username := regexp_replace(lower(base_username), '[^a-z0-9_]', '', 'g');
  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'user';
  END IF;
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || counter::text;
  END LOOP;

  SELECT COUNT(*) INTO total_users FROM public.profiles;
  IF total_users < 500 THEN
    bonus_f := 50 + floor(random() * 51)::int;
    bonus_l := 100;
    bonus_c := 5 + floor(random() * 16)::int;
  END IF;

  INSERT INTO public.profiles (id, username, display_name, bonus_followers, bonus_likes_per_post, bonus_comments)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'display_name', final_username),
    bonus_f,
    bonus_l,
    bonus_c
  );
  RETURN NEW;
END;
$function$;