import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/ifriend/SignedImage";
import { BellRing, Heart, Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/alarms")({
  component: AlarmsPage,
});

type AlarmRow = {
  id: string;
  sender_id: string;
  post_id: string | null;
  kind: "manual" | "auto";
  read_at: string | null;
  created_at: string;
  sender: { username: string; display_name: string; avatar_url: string | null } | null;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const flavor = [
  "❤️ has a heart for your vibe",
  "🔔 your Heart Alarm just activated",
  "💖 is thinking about your content",
  "❤️ you're on their radar",
  "🔥 a strong connection is forming",
];
function lineFor(id: string, kind: string) {
  if (kind === "manual") return "💖 sent you a Heart Alarm";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return flavor[h % flavor.length];
}

function AlarmsPage() {
  const { user } = Route.useRouteContext();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["heart-alarms", user.id],
    queryFn: async (): Promise<AlarmRow[]> => {
      const { data, error } = await (supabase as any)
        .from("heart_alarms")
        .select("id, sender_id, post_id, kind, read_at, created_at, sender:profiles!heart_alarms_sender_id_fkey(username, display_name, avatar_url)")
        .eq("receiver_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) {
        // fallback without aliased FK
        const r = await (supabase as any)
          .from("heart_alarms")
          .select("id, sender_id, post_id, kind, read_at, created_at")
          .eq("receiver_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (r.error) throw r.error;
        const ids = Array.from(new Set((r.data ?? []).map((a: any) => a.sender_id as string)));
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", ids);
        const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
        return (r.data ?? []).map((a: any) => ({ ...a, sender: map.get(a.sender_id) ?? null }));
      }
      return data ?? [];
    },
  });

  useEffect(() => {
    (supabase as any).rpc("mark_heart_alarms_read").then(() => {});
    const ch = supabase
      .channel("heart-alarms-" + user.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "heart_alarms", filter: `receiver_id=eq.${user.id}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user.id, refetch]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <span className="rounded-full brand-gradient p-2 text-primary-foreground glow">
            <BellRing className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-lg font-bold brand-text">Heart Alarms</h1>
            <p className="text-xs text-muted-foreground">Who's noticing your vibe</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-10 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 text-base font-semibold">No Heart Alarms yet</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            When someone keeps liking your posts or sends you a Heart, it shows up here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {data.map((a) => {
            const username = a.sender?.username ?? "someone";
            const display = a.sender?.display_name ?? username;
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <Link to="/p/$username" params={{ username }}>
                  <Avatar path={a.sender?.avatar_url ?? null} name={display} size={44} />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <Link
                      to="/p/$username"
                      params={{ username }}
                      className="font-semibold hover:underline"
                    >
                      {display}
                    </Link>{" "}
                    <span className="text-muted-foreground">{lineFor(a.id, a.kind)}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {a.kind === "auto" ? "Triggered by repeated likes" : "Sent on your post"} ·{" "}
                    {timeAgo(a.created_at)}
                  </p>
                </div>
                <Heart className="h-5 w-5 fill-primary text-primary" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
