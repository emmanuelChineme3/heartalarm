import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: u.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: AdminPage,
});

type Row = {
  id: string;
  username: string;
  display_name: string | null;
  created_at: string;
  bonus_followers: number;
  bonus_likes_per_post: number;
  bonus_comments: number | null;
  posts: number;
  followers: number;
  likes: number;
  comments: number;
};

function AdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, created_at, bonus_followers, bonus_likes_per_post, bonus_comments")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!profiles) { setRows([]); setLoading(false); return; }

    const ids = profiles.map((p) => p.id);
    const [{ data: posts }, { data: follows }, { data: likes }, { data: comments }] = await Promise.all([
      supabase.from("posts").select("user_id").in("user_id", ids),
      supabase.from("follows").select("following_id").in("following_id", ids),
      supabase.from("likes").select("post_id, posts!inner(user_id)").in("posts.user_id", ids),
      supabase.from("comments").select("user_id").in("user_id", ids),
    ]);

    const count = (arr: any[] | null, key: string) => {
      const m = new Map<string, number>();
      (arr ?? []).forEach((r: any) => {
        const k = key.includes(".") ? r.posts?.user_id : r[key];
        if (k) m.set(k, (m.get(k) ?? 0) + 1);
      });
      return m;
    };
    const postsM = count(posts as any, "user_id");
    const followsM = count(follows as any, "following_id");
    const likesM = count(likes as any, "posts.user_id");
    const commentsM = count(comments as any, "user_id");

    setRows(profiles.map((p) => ({
      ...p,
      posts: postsM.get(p.id) ?? 0,
      followers: followsM.get(p.id) ?? 0,
      likes: likesM.get(p.id) ?? 0,
      comments: commentsM.get(p.id) ?? 0,
    })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function bump(id: string, field: "bonus_followers" | "bonus_likes_per_post" | "bonus_comments", delta: number) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const next = Math.max(0, (row[field] ?? 0) + delta);
    const args: any = {
      _user_id: id,
      _bonus_followers: field === "bonus_followers" ? next : null,
      _bonus_likes_per_post: field === "bonus_likes_per_post" ? next : null,
      _bonus_comments: field === "bonus_comments" ? next : null,
    };
    const { error } = await supabase.rpc("admin_update_bonuses", args);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: next } : r)));
    toast.success("Updated");
  }

  const filtered = rows.filter((r) =>
    !q || r.username.toLowerCase().includes(q.toLowerCase()) ||
    (r.display_name ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline"><Link to="/admin/support">Support accounts</Link></Button>
          <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
        </div>
      </div>
      <Input placeholder="Search username…" value={q} onChange={(e) => setQ(e.target.value)} />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <Link to="/p/$username" params={{ username: r.username }} className="font-semibold hover:underline">
                  @{r.username}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-2 text-center text-xs">
                <Stat label="Posts" value={r.posts} />
                <Stat label="Followers" value={r.followers + r.bonus_followers} />
                <Stat label="Likes" value={r.likes} />
                <Stat label="Comments" value={r.comments} />
              </div>
              <div className="mt-3 space-y-2">
                <BonusRow label="Bonus followers" value={r.bonus_followers}
                  onMinus={() => bump(r.id, "bonus_followers", -10)}
                  onPlus={() => bump(r.id, "bonus_followers", 10)} />
                <BonusRow label="Bonus likes / post" value={r.bonus_likes_per_post}
                  onMinus={() => bump(r.id, "bonus_likes_per_post", -10)}
                  onPlus={() => bump(r.id, "bonus_likes_per_post", 10)} />
                <BonusRow label="Bonus comments" value={r.bonus_comments ?? 0}
                  onMinus={() => bump(r.id, "bonus_comments", -1)}
                  onPlus={() => bump(r.id, "bonus_comments", 1)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted py-1.5">
      <div className="font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function BonusRow({ label, value, onMinus, onPlus }: { label: string; value: number; onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onMinus}>−</Button>
        <span className="w-10 text-center text-sm font-semibold">{value}</span>
        <Button size="sm" variant="outline" onClick={onPlus}>+</Button>
      </div>
    </div>
  );
}
