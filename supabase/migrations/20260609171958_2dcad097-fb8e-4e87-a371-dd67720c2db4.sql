
-- Follows table
CREATE TABLE public.follows (
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY follows_select_all ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY follows_insert_own ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY follows_delete_own ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);

-- Bonus columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN bonus_followers INT NOT NULL DEFAULT 0,
  ADD COLUMN bonus_likes_per_post INT NOT NULL DEFAULT 0;

-- Update new-user trigger to give first 1000 users the welcome bonus
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 0;
  total_users INT;
  bonus_f INT := 0;
  bonus_l INT := 0;
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
  IF total_users < 1000 THEN
    bonus_f := 50 + floor(random() * 51)::int; -- 50-100
    bonus_l := 100;
  END IF;

  INSERT INTO public.profiles (id, username, display_name, bonus_followers, bonus_likes_per_post)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'display_name', final_username),
    bonus_f,
    bonus_l
  );
  RETURN NEW;
END;
$function$;

-- Grant bonus to existing users (first 1000)
UPDATE public.profiles
SET bonus_followers = 50 + floor(random() * 51)::int,
    bonus_likes_per_post = 100
WHERE bonus_followers = 0 AND bonus_likes_per_post = 0;
