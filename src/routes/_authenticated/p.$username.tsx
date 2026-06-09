import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, SignedImage } from "@/components/ifriend/SignedImage";
import { Button } from "@/components/ui/button";
import { Loader2, Settings } from "lucide-react";

export const Route = createFileRoute("/_authenticated/p/$username")({
  component: ProfilePage,
});

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type Post = { id: string; media_url: string; media_type: string };

function ProfilePage() {
  const { username } = Route.useParams();
  const { user } = Route.useRouteContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [counts, setCounts] = useState({ posts: 0, likes: 0 });
  const [loading, setLoading] = useState(true);
  const [notFoundFlag, setNotFoundFlag] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url")
        .eq("username", username)
        .maybeSingle();
      if (!active) return;
      if (!p) {
        setNotFoundFlag(true);
        setLoading(false);
        return;
      }
      setProfile(p as Profile);
      const [{ data: ps }, { count: likeCount }] = await Promise.all([
        supabase
          .from("posts")
          .select("id, media_url, media_type")
          .eq("user_id", p.id)
          .order("created_at", { ascending: false }),
        supabase.from("likes").select("post_id", { count: "exact", head: true }).in(
          "post_id",
          ((await supabase.from("posts").select("id").eq("user_id", p.id)).data ?? []).map((r: any) => r.id),
        ),
      ]);
      if (!active) return;
      setPosts((ps ?? []) as Post[]);
      setCounts({ posts: ps?.length ?? 0, likes: likeCount ?? 0 });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [username]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (notFoundFlag || !profile) {
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center">
        <h2 className="text-lg font-semibold">User not found</h2>
      </div>
    );
  }
  const isMe = profile.id === user.id;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar path={profile.avatar_url} name={profile.display_name ?? profile.username} size={86} />
        <div className="flex flex-1 items-center gap-5 text-center">
          <Stat n={counts.posts} label="Posts" />
          <Stat n={counts.likes} label="Likes" />
        </div>
      </div>

      <div>
        <div className="text-lg font-bold">{profile.display_name ?? profile.username}</div>
        <div className="text-sm text-muted-foreground">@{profile.username}</div>
        {profile.bio && <p className="mt-2 whitespace-pre-wrap text-sm">{profile.bio}</p>}
      </div>

      {isMe && (
        <Button asChild variant="outline" className="w-full">
          <Link to="/settings">
            <Settings className="mr-2 h-4 w-4" /> Edit profile
          </Link>
        </Button>
      )}

      <div className="grid grid-cols-3 gap-1">
        {posts.map((p) => (
          <div key={p.id} className="relative aspect-square overflow-hidden bg-muted">
            <SignedImage
              bucket="posts"
              path={p.media_url}
              alt="Post"
              className="h-full w-full object-cover"
            />
          </div>
        ))}
        {posts.length === 0 && (
          <div className="col-span-3 rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No posts yet.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex-1">
      <div className="text-lg font-bold">{n}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
