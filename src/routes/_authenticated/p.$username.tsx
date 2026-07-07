import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, SignedImage } from "@/components/ifriend/SignedImage";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/ifriend/FollowButton";
import { Loader2, Settings, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { levelFor } from "@/lib/ifriend/levels";
import { VIBES } from "@/lib/ifriend/vibes";
import { ringCountFor } from "@/lib/ifriend/alarmSound";

export const Route = createFileRoute("/_authenticated/p/$username")({
  component: ProfilePage,
});

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  bonus_followers: number | null;
  bonus_comments: number | null;
  points: number | null;
  vibes: string[] | null;
};

type Post = { id: string; media_url: string; media_type: string };

function ProfilePage() {
  const { username } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [counts, setCounts] = useState({ posts: 0, followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);
  const [notFoundFlag, setNotFoundFlag] = useState(false);
  const [msgBusy, setMsgBusy] = useState(false);

  async function refreshCounts(uid: string, postCount: number, bonus: number) {
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", uid),
      supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", uid),
    ]);
    setCounts({
      posts: postCount,
      followers: (followers ?? 0) + bonus,
      following: following ?? 0,
    });
  }

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url, bonus_followers, bonus_comments, points, vibes")
        .eq("username", username)
        .maybeSingle();
      if (!active) return;
      if (!p) {
        setNotFoundFlag(true);
        setLoading(false);
        return;
      }
      setProfile(p as Profile);
      const { data: ps } = await supabase
        .from("posts")
        .select("id, media_url, media_type")
        .eq("user_id", p.id)
        .order("created_at", { ascending: false });
      if (!active) return;
      setPosts((ps ?? []) as Post[]);
      await refreshCounts(p.id, ps?.length ?? 0, (p as any).bonus_followers ?? 0);
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

  async function startMessage() {
    if (!profile || isMe) return;
    setMsgBusy(true);
    try {
      const { data: mine } = await supabase
        .from("conversation_members")
        .select("conversation_id, conversations!inner(is_group)")
        .eq("user_id", user.id);
      const myDmIds = (mine ?? [])
        .filter((m: any) => m.conversations && !m.conversations.is_group)
        .map((m: any) => m.conversation_id);
      if (myDmIds.length) {
        const { data: theirs } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", profile.id)
          .in("conversation_id", myDmIds);
        const existing = theirs?.[0]?.conversation_id;
        if (existing) {
          navigate({ to: "/chat/$id", params: { id: existing } });
          return;
        }
      }
      const { data: convId, error: rpcErr } = await supabase.rpc("create_conversation", {
        _is_group: false,
        _name: "",
        _member_ids: [profile.id],
      });
      if (rpcErr || !convId) throw rpcErr ?? new Error("Failed to create conversation");
      navigate({ to: "/chat/$id", params: { id: convId as string } });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't start chat");
    } finally {
      setMsgBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar path={profile.avatar_url} name={profile.display_name ?? profile.username} size={86} />
        <div className="flex flex-1 items-center gap-3 text-center">
          <Stat n={counts.posts} label="Posts" />
          <Stat n={counts.followers} label="Followers" />
          <Stat n={counts.following} label="Following" />
        </div>
      </div>

      <div>
        <div className="text-lg font-bold">{profile.display_name ?? profile.username}</div>
        <div className="text-sm text-muted-foreground">@{profile.username}</div>
      {profile.bio && <p className="mt-2 whitespace-pre-wrap text-sm">{profile.bio}</p>}
        {profile.bonus_comments && profile.bonus_comments > 0 && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <span>Free comments: {profile.bonus_comments}</span>
          </div>
        )}
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          🔔 Ring power: {"❤️".repeat(ringCountFor(profile.id))} ×{ringCountFor(profile.id)}
        </div>
        <ProfileLevel points={profile.points ?? 0} vibes={profile.vibes ?? []} />
      </div>

      {isMe ? (
        <Button asChild variant="outline" className="w-full">
          <Link to="/settings">
            <Settings className="mr-2 h-4 w-4" /> Edit profile
          </Link>
        </Button>
      ) : (
        <div className="flex gap-2">
          <div className="flex-1">
            <FollowButton
              currentUserId={user.id}
              targetUserId={profile.id}
              onChange={(f) =>
                setCounts((c) => ({ ...c, followers: c.followers + (f ? 1 : -1) }))
              }
            />
          </div>
          <Button
            variant="outline"
            className="flex-1"
            onClick={startMessage}
            disabled={msgBusy}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            {msgBusy ? "Opening…" : "Message"}
          </Button>
        </div>
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

function ProfileLevel({ points, vibes }: { points: number; vibes: string[] }) {
  const { current, next, pct } = levelFor(points);
  const labels = VIBES.filter((v) => vibes.includes(v.key));
  return (
    <div className="mt-3 space-y-2">
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{current.emoji} {current.name}</span>
          <span className="text-xs text-muted-foreground">
            {points} pts{next ? ` · ${next.min - points} to ${next.name}` : ""}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full brand-gradient" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((v) => (
            <span key={v.key} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px]">
              <span>{v.emoji}</span> {v.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
