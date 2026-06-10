
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS free_comments_remaining INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.set_post_free_comments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rank_pos INT;
BEGIN
  SELECT position INTO rank_pos FROM (
    SELECT id, row_number() OVER (ORDER BY created_at ASC) AS position
    FROM public.profiles
  ) ranked WHERE id = NEW.user_id;

  IF rank_pos IS NOT NULL AND rank_pos <= 500 THEN
    NEW.free_comments_remaining := 5 + floor(random() * 6)::int;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_post_free_comments ON public.posts;
CREATE TRIGGER trg_set_post_free_comments
BEFORE INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.set_post_free_comments();

-- Backfill existing posts by early users
WITH ranked AS (
  SELECT id FROM (
    SELECT id, row_number() OVER (ORDER BY created_at ASC) AS pos
    FROM public.profiles
  ) r WHERE pos <= 500
)
UPDATE public.posts p
SET free_comments_remaining = 5 + floor(random() * 6)::int
WHERE p.free_comments_remaining = 0
  AND p.user_id IN (SELECT id FROM ranked);
