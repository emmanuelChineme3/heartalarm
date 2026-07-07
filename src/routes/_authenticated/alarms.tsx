import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/ifriend/SignedImage";
import { BellRing, Heart, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlarmRingModal } from "@/components/ifriend/AlarmRingModal";
import { ringCountFor } from "@/lib/ifriend/alarmSound";

export const Route = createFileRoute("/_authenticated/alarms")({
  component: AlarmsPage,
});

type Profile = { id: string; username: string; display_name: string | null; avatar_url: string | null };
type AlarmRow = {
  id: string;
  sender_id: string | null;
  virtual_sender_id: string | null;
  post_id: string | null;
  kind: "manual" | "auto";
  read_at: string | null;
  revealed_at: string | null;
  reveal_post_id: string | null;
  created_at: string;
  sender: Profile | null;
  admirer: Profile | null;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function AlarmsPage() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const rings = useMemo(() => ringCountFor(user.id), [user.id]);
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["heart-alarms", user.id, rings],
    queryFn: async (): Promise<AlarmRow[]> => {
      // Fill up to `rings` so the user always has at least one signal.
      await (supabase as any).rpc("ensure_min_heart_alarms", { _target: rings });

      const { data: rows, error } = await (supabase as any)
        .from("heart_alarms")
        .select("id, sender_id, virtual_sender_id, post_id, kind, read_at, revealed_at, reveal_post_id, created_at")
        .eq("receiver_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const ids = new Set<string>();
      (rows ?? []).forEach((r: any) => {
        if (r.sender_id) ids.add(r.sender_id);
        if (r.virtual_sender_id) ids.add(r.virtual_sender_id);
      });
      let profiles: Profile[] = [];
      if (ids.size > 0) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", Array.from(ids));
        profiles = (p as Profile[] | null) ?? [];
      }
      const pmap = new Map(profiles.map((p) => [p.id, p]));
      return (rows ?? []).map((r: any) => ({
        ...r,
        sender: r.sender_id ? pmap.get(r.sender_id) ?? null : null,
        admirer:
          (r.sender_id ? pmap.get(r.sender_id) : null) ??
          (r.virtual_sender_id ? pmap.get(r.virtual_sender_id) : null) ??
          null,
      }));
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

  // Auto-open modal once per session if there is at least one unrevealed alarm.
  useEffect(() => {
    if (!data || data.length === 0) return;
    if (typeof window === "undefined") return;
    const key = "heart-alarm-shown-" + user.id;
    if (sessionStorage.getItem(key)) return;
    const unrevealed = data.find((a) => !a.revealed_at);
    if (unrevealed) {
      sessionStorage.setItem(key, "1");
      setShowModal(true);
    }
  }, [data, user.id]);

  function startReveal(alarmId: string) {
    router.navigate({ to: "/upload", search: { reveal: alarmId } });
  }

  return (
    <div className="space-y-4">
      <AlarmRingModal
        open={showModal}
        rings={rings}
        onReveal={() => {
          const first = data?.find((a) => !a.revealed_at);
          setShowModal(false);
          if (first) startReveal(first.id);
        }}
        onLeave={() => setShowModal(false)}
      />

      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full brand-gradient p-2 text-primary-foreground glow">
              <BellRing className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-lg font-bold brand-text">Heart Alarms</h1>
              <p className="text-xs text-muted-foreground">Who's noticing your vibe</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Your ring power</div>
            <div className="text-lg font-extrabold text-primary">
              {"❤️".repeat(rings)} <span className="text-sm text-foreground">×{rings}</span>
            </div>
          </div>
        </div>
        {data && data.length > 0 && (
          <Button
            onClick={() => setShowModal(true)}
            className="mt-3 w-full brand-gradient text-primary-foreground"
          >
            🔔 Ring my Heart Alarm
          </Button>
        )}
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
            const revealed = !!a.revealed_at;
            const admirer = a.admirer;
            const displayName = revealed && admirer ? (admirer.display_name ?? admirer.username) : "Mystery admirer";
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                {revealed && admirer ? (
                  <Link to="/p/$username" params={{ username: admirer.username }}>
                    <Avatar path={admirer.avatar_url} name={displayName} size={44} />
                  </Link>
                ) : (
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full brand-gradient text-primary-foreground"
                    aria-hidden
                  >
                    <Heart className="h-5 w-5" fill="currentColor" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-semibold">{displayName}</span>{" "}
                    <span className="text-muted-foreground">
                      {revealed ? "has a heart for your vibe" : "sent you a Heart Alarm"}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {timeAgo(a.created_at)}
                    {revealed ? " · revealed" : " · someone somewhere ❤️"}
                  </p>
                </div>
                {!revealed && (
                  <Button
                    size="sm"
                    onClick={() => startReveal(a.id)}
                    className="brand-gradient text-primary-foreground"
                  >
                    Reveal
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
