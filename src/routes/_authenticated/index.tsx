import { createFileRoute } from "@tanstack/react-router";
import { Fragment } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type FeedPost } from "@/components/ifriend/PostCard";
import { AdsterraNative } from "@/components/ifriend/AdsterraNative";
import { GroupsCTA } from "@/components/ifriend/GroupsCTA";
import { StoriesTray } from "@/components/ifriend/StoriesTray";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: Feed,
});

async function fetchFeed(currentUserId: string): Promise<FeedPost[]> {
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, user_id, media_url, media_type, caption, music_url, music_title, music_provider, free_comments_remaining, created_at, profiles!posts_user_id_profiles_fkey(username, display_name, avatar_url, bonus_likes_per_post)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const ids = (posts ?? []).map((p) => p.id);
  if (ids.length === 0) return [];

  const [{ data: likes }, { data: commentsRows }, { data: myLikes }] = await Promise.all([
    supabase.from("likes").select("post_id").in("post_id", ids),
    supabase.from("comments").select("post_id").in("post_id", ids),
    supabase.from("likes").select("post_id").eq("user_id", currentUserId).in("post_id", ids),
  ]);

  const likeMap = new Map<string, number>();
  (likes ?? []).forEach((l: any) => likeMap.set(l.post_id, (likeMap.get(l.post_id) ?? 0) + 1));
  const commentMap = new Map<string, number>();
  (commentsRows ?? []).forEach((c: any) =>
    commentMap.set(c.post_id, (commentMap.get(c.post_id) ?? 0) + 1),
  );
  const myLikeSet = new Set((myLikes ?? []).map((l: any) => l.post_id));


  return (posts ?? []).map((p: any) => ({
    id: p.id,
    user_id: p.user_id,
    media_url: p.media_url,
    media_type: p.media_type,
    caption: p.caption,
    music_url: p.music_url ?? null,
    music_title: p.music_title ?? null,
    free_comments_remaining: p.free_comments_remaining ?? 0,
    created_at: p.created_at,
    username: p.profiles?.username ?? "user",
    display_name: p.profiles?.display_name ?? p.profiles?.username ?? "user",
    avatar_url: p.profiles?.avatar_url ?? null,
    likes_count: (likeMap.get(p.id) ?? 0) + (p.profiles?.bonus_likes_per_post ?? 0),
    comments_count: commentMap.get(p.id) ?? 0,
    liked_by_me: myLikeSet.has(p.id),
  }));
}

function Feed() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["feed", user.id],
    queryFn: () => fetchFeed(user.id),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="space-y-4">
        <StoriesTray currentUserId={user.id} />
        <GroupsCTA userId={user.id} />
        <div className="rounded-3xl border border-border bg-card p-10 text-center">
          <h2 className="text-lg font-semibold">Your feed is empty</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Share your first moment from the + tab below.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <GroupsCTA userId={user.id} />
      {data.map((p, i) => (
        <Fragment key={p.id}>
          <PostCard
            post={p}
            currentUserId={user.id}
            onChanged={() => qc.invalidateQueries({ queryKey: ["feed"] })}
          />
          {(i + 1) % 4 === 0 && <AdsterraNative />}
        </Fragment>
      ))}
    </div>
  );
}
