import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type FeedPost } from "@/components/ifriend/PostCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/post/$id")({
  component: PostPage,
});

async function fetchPost(id: string, currentUserId: string): Promise<FeedPost | null> {
  const { data: p, error } = await supabase
    .from("posts")
    .select(
      "id, user_id, media_url, media_type, caption, music_url, music_title, border_style, free_comments_remaining, created_at, profiles!posts_user_id_profiles_fkey(username, display_name, avatar_url, bonus_likes_per_post)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!p) return null;

  const [{ count: likes }, { count: comments }, { data: myLike }] = await Promise.all([
    supabase.from("likes").select("post_id", { count: "exact", head: true }).eq("post_id", id),
    supabase.from("comments").select("post_id", { count: "exact", head: true }).eq("post_id", id),
    supabase.from("likes").select("post_id").eq("post_id", id).eq("user_id", currentUserId),
  ]);

  const row: any = p;
  return {
    id: row.id,
    user_id: row.user_id,
    media_url: row.media_url,
    media_type: row.media_type,
    caption: row.caption,
    music_url: row.music_url ?? null,
    music_title: row.music_title ?? null,
    border_style: row.border_style ?? null,
    free_comments_remaining: row.free_comments_remaining ?? 0,
    created_at: row.created_at,
    username: row.profiles?.username ?? "user",
    display_name: row.profiles?.display_name ?? row.profiles?.username ?? "user",
    avatar_url: row.profiles?.avatar_url ?? null,
    likes_count: (likes ?? 0) + (row.profiles?.bonus_likes_per_post ?? 0),
    comments_count: comments ?? 0,
    liked_by_me: (myLike ?? []).length > 0,
  };
}

function PostPage() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["post", id, user.id],
    queryFn: () => fetchPost(id, user.id),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center">
        <h1 className="text-lg font-semibold">Post not found</h1>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <PostCard
        post={data}
        currentUserId={user.id}
        onChanged={() => {
          void refetch().then((r) => {
            if (!r.data) navigate({ to: "/" });
          });
        }}
      />
    </div>
  );
}
