
-- ============ Profile additions ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vibes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS points int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;

-- ============ Stories ============
CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image','video')),
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX stories_user_idx ON public.stories(user_id, created_at DESC);
CREATE INDEX stories_active_idx ON public.stories(expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active stories visible to authed"
  ON public.stories FOR SELECT TO authenticated
  USING (expires_at > now() OR user_id = auth.uid());
CREATE POLICY "create own stories"
  ON public.stories FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own stories"
  ON public.stories FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- views
CREATE TABLE public.story_views (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);
GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view rows visible to story owner and viewer"
  ON public.story_views FOR SELECT TO authenticated
  USING (viewer_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid()
  ));
CREATE POLICY "record own view"
  ON public.story_views FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid());

-- likes
CREATE TABLE public.story_likes (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.story_likes TO authenticated;
GRANT ALL ON public.story_likes TO service_role;
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story likes readable to authed"
  ON public.story_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "like as self"
  ON public.story_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "unlike as self"
  ON public.story_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;

-- ============ Challenges ============
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('daily','weekly')),
  points int NOT NULL DEFAULT 10,
  emoji text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges readable" ON public.challenges
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.challenge_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);
GRANT SELECT, INSERT ON public.challenge_completions TO authenticated;
GRANT ALL ON public.challenge_completions TO service_role;
ALTER TABLE public.challenge_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own completions"
  ON public.challenge_completions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "complete as self"
  ON public.challenge_completions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Award points on completion
CREATE OR REPLACE FUNCTION public.award_challenge_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pts int;
BEGIN
  SELECT points INTO pts FROM public.challenges WHERE id = NEW.challenge_id;
  IF pts IS NULL THEN pts := 0; END IF;
  UPDATE public.profiles
     SET points = points + pts, updated_at = now()
   WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_award_challenge_points ON public.challenge_completions;
CREATE TRIGGER trg_award_challenge_points
  AFTER INSERT ON public.challenge_completions
  FOR EACH ROW EXECUTE FUNCTION public.award_challenge_points();

-- Helper: complete-by-key
CREATE OR REPLACE FUNCTION public.complete_challenge(_key text, _post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  c_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO c_id FROM public.challenges
   WHERE key = _key
     AND (ends_at IS NULL OR ends_at > now())
     AND starts_at <= now()
   LIMIT 1;
  IF c_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.challenge_completions (challenge_id, user_id, post_id)
  VALUES (c_id, uid, _post_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Seed challenges
INSERT INTO public.challenges (key, title, description, kind, points, emoji) VALUES
  ('vibe_photo', 'Post a vibe photo', 'Share a photo that captures your mood today.', 'daily', 15, '📸'),
  ('music_mood', 'Share a music mood', 'Post anything with a music track attached.', 'daily', 20, '🎵'),
  ('sports_moment', 'Sports moment', 'Post a sports clip or photo this week.', 'weekly', 40, '🏀'),
  ('school_life', 'School life snapshot', 'Share a slice of your school life.', 'weekly', 30, '🎒'),
  ('weekly_streak', 'Post 3 times this week', 'Stay active — post 3 times in 7 days.', 'weekly', 60, '🔥')
ON CONFLICT (key) DO NOTHING;
