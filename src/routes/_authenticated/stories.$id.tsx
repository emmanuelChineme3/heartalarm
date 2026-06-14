import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/ifriend/SignedImage";
import { getSignedUrl } from "@/lib/ifriend/media";
import { Heart, Eye, X, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/stories/$id")({
  component: StoryViewer,
});

type Story = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

function StoryViewer() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [story, setStory] = useState<Story | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("stories")
        .select("id, user_id, media_url, media_type, caption, created_at, expires_at")
        .eq("id", id)
        .maybeSingle();
      if (cancel || !data) { setLoading(false); return; }
      const { data: prof } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", data.user_id)
        .maybeSingle();
      const s: Story = {
        ...data,
        username: prof?.username ?? "user",
        display_name: prof?.display_name ?? null,
        avatar_url: prof?.avatar_url ?? null,
      };
      setStory(s);
      const u = await getSignedUrl("stories", data.media_url);
      if (cancel) return;
      setSrc(u);

      // record view + counts
      await (supabase as any).from("story_views").upsert(
        { story_id: id, viewer_id: user.id },
        { onConflict: "story_id,viewer_id" }
      );
      const [{ count: vc }, { count: lc }, { data: mine }] = await Promise.all([
        (supabase as any).from("story_views").select("*", { count: "exact", head: true }).eq("story_id", id),
        (supabase as any).from("story_likes").select("*", { count: "exact", head: true }).eq("story_id", id),
        (supabase as any).from("story_likes").select("user_id").eq("story_id", id).eq("user_id", user.id).maybeSingle(),
      ]);
      setViewCount(vc ?? 0);
      setLikeCount(lc ?? 0);
      setLiked(!!mine);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [id, user.id]);

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    if (next) {
      const { error } = await (supabase as any).from("story_likes").insert({ story_id: id, user_id: user.id });
      if (error) { setLiked(false); setLikeCount((c) => c - 1); }
    } else {
      await (supabase as any).from("story_likes").delete().eq("story_id", id).eq("user_id", user.id);
    }
  }

  async function deleteStory() {
    if (!story || story.user_id !== user.id) return;
    if (!confirm("Delete this story?")) return;
    await (supabase as any).from("stories").delete().eq("id", id);
    supabase.storage.from("stories").remove([story.media_url]).catch(() => {});
    toast.success("Deleted");
    navigate({ to: "/" });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!story) {
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center">
        <h2 className="font-semibold">Story not found or expired</h2>
        <button onClick={() => navigate({ to: "/" })} className="mt-3 text-sm text-primary underline">Back</button>
      </div>
    );
  }

  const isMine = story.user_id === user.id;

  return (
    <div className="mx-auto max-w-sm space-y-3">
      <div className="flex items-center gap-3">
        <Link to="/p/$username" params={{ username: story.username }} className="flex items-center gap-2">
          <Avatar path={story.avatar_url} name={story.display_name ?? story.username} size={36} />
          <span className="text-sm font-semibold">{story.display_name ?? story.username}</span>
        </Link>
        <button onClick={() => navigate({ to: "/" })} className="ml-auto rounded-full p-2 hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="relative aspect-[9/16] overflow-hidden rounded-3xl bg-black">
        {src ? (
          story.media_type === "video" ? (
            <video src={src} autoPlay controls playsInline className="h-full w-full object-cover" />
          ) : (
            <img src={src} alt={story.caption ?? "Story"} className="h-full w-full object-cover" />
          )
        ) : (
          <div className="h-full w-full animate-pulse bg-muted" />
        )}
        {story.caption && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-sm text-white">
            {story.caption}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <button onClick={toggleLike} className="flex items-center gap-1.5">
          <Heart className={`h-6 w-6 ${liked ? "fill-primary text-primary" : ""}`} />
          <span className="font-semibold">{likeCount}</span>
        </button>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Eye className="h-5 w-5" />
          <span className="font-semibold">{viewCount}</span>
        </div>
        {isMine && (
          <button onClick={deleteStory} className="ml-auto rounded-full p-2 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
