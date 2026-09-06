import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { acknowledgeRing } from "@/lib/ifriend/rings";
import { AlarmRingModal } from "@/components/ifriend/AlarmRingModal";
import { ringCountFor } from "@/lib/ifriend/alarmSound";
import { startAdMob } from "@/lib/ifriend/admob";
import { appIsForeground, notifyIncomingRing, requestRingNotificationPermission } from "@/lib/ifriend/ringNotify";
import { registerPushNotifications } from "@/lib/ifriend/pushRegister";
import { flushPendingConsent } from "@/lib/legal/consent";
import { Home, Search, PlusSquare, User, LogOut, MessageCircle, UserPlus, Shield, Trophy } from "lucide-react";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

const TOUR_STEPS = [
  {
    emoji: "🏠",
    title: "Your Feed",
    body: "Scroll posts from people you follow. Tap the 💗 bell on a post to ring that person's Heart Alarm.",
  },
  {
    emoji: "🔔",
    title: "Heart Alarms",
    body: "When someone rings you, your screen lights up. Post to reveal who it was — or keep scrolling and it waits for you.",
  },
  {
    emoji: "💗",
    title: "Ring a Friend",
    body: "Pick a friend from your contacts and make their Heart Alarm ring, wherever they are.",
  },
  {
    emoji: "✨",
    title: "Your turn",
    body: "You've felt your first ring. Now send one to someone you love.",
  },
];

function AuthedLayout() {
  const refetchAlarmsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    void startAdMob();
    // Push permission MUST be requested first and awaited: on Android 13+ both
    // push and local notifications share POST_NOTIFICATIONS, and two concurrent
    // requests make the system dialog never appear.
    void (async () => {
      await registerPushNotifications(() => {
        // Tapping the push opens the app → replay the full ringing experience.
        refetchAlarmsRef.current?.();
      });
      await requestRingNotificationPermission();
    })();
  }, []);


  const { user } = Route.useRouteContext();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [tourStep, setTourStep] = useState(-1); // -1 = hidden

  useEffect(() => {
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(!!data));
    void flushPendingConsent(user.id);
    // If this user joined via a shared ring link, connect them to that ring.
    void import("@/lib/ifriend/ringFriends").then(async ({ RING_LINK_STORAGE_KEY }) => {
      const token = window.localStorage.getItem(RING_LINK_STORAGE_KEY);
      if (!token) return;
      window.localStorage.removeItem(RING_LINK_STORAGE_KEY);
      const { data } = await (supabase as any).rpc("claim_ring_link", { _token: token });
      if (data) refetchAlarmsRef.current?.();
    });
    // Onboarding gate
    const path = window.location.pathname;
    if (path === "/onboarding" || path === "/auth") return;
    (supabase as any)
      .from("profiles")
      .select("onboarded, tour_done, welcome_ring_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data && data.onboarded === false) {
          router.navigate({ to: "/onboarding", replace: true });
          return;
        }
        // Tour is only for genuinely new users who received the welcome ring.
        if (data && data.welcome_ring_at && !data.tour_done) {
          setIsNewUser(true);
        }
      });
  }, [user.id, router]);

  // ── Live Heart Alarm ring (receiver side) ────────────────────────────────
  // Lifecycle per ring: pending → shown once → acknowledged (server-side).
  const queryClient = useQueryClient();
  const [incomingAlarmId, setIncomingAlarmId] = useState<string | null>(null);
  const [pendingAlarmId, setPendingAlarmId] = useState<string | null>(null);

  const { data: pendingAlarms, refetch: refetchAlarms } = useQuery({
    queryKey: ["pending-heart-alarm", user.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("heart_alarms")
        .select("id, acknowledged_at")
        .eq("receiver_id", user.id)
        .is("revealed_at", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      return (data ?? []) as { id: string; acknowledged_at: string | null }[];
    },
  });

  refetchAlarmsRef.current = () => {
    void refetchAlarms();
  };

  const ackAlarm = useCallback(
    async (id: string) => {
      await acknowledgeRing(id);
      await queryClient.invalidateQueries({ queryKey: ["pending-heart-alarm", user.id] });
    },
    [queryClient, user.id],
  );

  useEffect(() => {
    if (incomingAlarmId) return;
    if (!pendingAlarms) return;
    if (pendingAlarms.length === 0) {
      setPendingAlarmId(null);
      return;
    }
    const alarm = pendingAlarms[0];
    setPendingAlarmId(alarm.id);
    // Full-screen ring plays only once per ring, and only while the app is open.
    if (alarm.acknowledged_at) return;
    if (!appIsForeground()) return;
    setIncomingAlarmId(alarm.id);
  }, [pendingAlarms, incomingAlarmId]);

  // New-user tour: starts only AFTER they've experienced their first ring.
  useEffect(() => {
    if (!isNewUser || tourStep >= 0) return;
    if (incomingAlarmId) return; // let the ring play first
    const latest = pendingAlarms?.[0];
    if (latest && !latest.acknowledged_at) return; // ring hasn't been experienced yet
    setTourStep(0);
  }, [isNewUser, tourStep, incomingAlarmId, pendingAlarms]);

  async function finishTour(goRing: boolean) {
    setTourStep(-1);
    setIsNewUser(false);
    await (supabase as any).rpc("complete_tour").catch(() => undefined);
    if (goRing) router.navigate({ to: "/ring" });
  }

  // When the app comes back to the foreground, re-check for unacknowledged rings.
  useEffect(() => {
    const onVisible = () => {
      if (!appIsForeground()) return;
      void refetchAlarms();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refetchAlarms]);

  useEffect(() => {
    const ch = supabase
      .channel("live-alarms-" + user.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "heart_alarms",
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload: any) => {
          const id = payload.new?.id ?? null;
          if (!id) return;
          setPendingAlarmId(id);
          if (!appIsForeground()) {
            // Recipient is outside the app: notify now, ring on next open.
            void notifyIncomingRing();
            return;
          }
          setIncomingAlarmId(id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user.id]);

  // ── Unread messages badge ────────────────────────────────────────────────
  const [unread, setUnread] = useState(0);
  const loadUnread = useCallback(async () => {
    const { data: memberships } = await supabase
      .from("conversation_members")
      .select("conversation_id, last_read_at")
      .eq("user_id", user.id);
    let total = 0;
    for (const m of memberships ?? []) {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", (m as any).conversation_id)
        .gt("created_at", (m as any).last_read_at)
        .neq("sender_id", user.id);
      total += count ?? 0;
    }
    setUnread(total);
  }, [user.id]);

  useEffect(() => {
    loadUnread();
    const ch = supabase
      .channel("unread-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => loadUnread())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, () => loadUnread())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user.id, loadUnread]);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }


  return (
    <div className="min-h-screen bg-background text-foreground">
      <AlarmRingModal
        open={!!incomingAlarmId}
        rings={ringCountFor(user.id)}
        variant="receiver"
        onReveal={() => {
          const id = incomingAlarmId ?? pendingAlarmId;
          setIncomingAlarmId(null);
          if (id) {
            void ackAlarm(id);
            router.navigate({ to: "/upload", search: { reveal: id } });
          }
        }}
        onLeave={() => {
          const id = incomingAlarmId;
          setIncomingAlarmId(null);
          if (id) void ackAlarm(id);
        }}
      />

      {!incomingAlarmId && pendingAlarmId && (
        <button
          onClick={() =>
            router.navigate({ to: "/upload", search: { reveal: pendingAlarmId } })
          }
          className="fixed left-1/2 top-3 z-40 -translate-x-1/2 rounded-full brand-gradient px-4 py-2 text-xs font-bold text-primary-foreground shadow-lg glow"
        >
          💗 A heart is waiting · post to reveal
        </button>

      )}

      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">

        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-2xl font-extrabold tracking-tight brand-text">
            Heart Alarm
          </Link>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <Link
                to="/admin"
                className="rounded-full p-2 text-muted-foreground hover:text-foreground"
                aria-label="Admin"
                title="Admin"
              >
                <Shield className="h-5 w-5" />
              </Link>
            )}
            <Link
              to="/challenges"
              className="rounded-full p-2 text-muted-foreground hover:text-foreground"
              aria-label="Challenges"
              title="Challenges"
            >
              <Trophy className="h-5 w-5" />
            </Link>
            <Link
              to="/invite"
              className="rounded-full p-2 text-muted-foreground hover:text-foreground"
              aria-label="Invite friends"
              title="Invite friends"
            >
              <UserPlus className="h-5 w-5" />
            </Link>
            <button
              onClick={signOut}
              className="rounded-full p-2 text-muted-foreground hover:text-foreground"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-40 pt-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-1 py-2">
          <NavItem to="/" icon={<Home className="h-5 w-5" />} label="Home" />
          <NavItem to="/search" icon={<Search className="h-5 w-5" />} label="Search" />
          <NavItem to="/upload" icon={<PlusSquare className="h-5 w-5" />} label="Post" />
          
          <NavItem to="/inbox" icon={<MessageCircle className="h-5 w-5" />} label="Inbox" badge={unread} />
          <NavItem to="/me" icon={<User className="h-5 w-5" />} label="Me" />

        </div>
      </nav>

      {tourStep >= 0 && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={() => void finishTour(false)}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-3xl border border-border bg-card p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-4xl">{TOUR_STEPS[tourStep].emoji}</p>
            <div>
              <h2 className="text-lg font-extrabold brand-text">{TOUR_STEPS[tourStep].title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{TOUR_STEPS[tourStep].body}</p>
            </div>
            <div className="flex justify-center gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full ${i === tourStep ? "w-5 bg-primary" : "w-1.5 bg-muted"}`}
                />
              ))}
            </div>
            {tourStep < TOUR_STEPS.length - 1 ? (
              <button
                onClick={() => setTourStep(tourStep + 1)}
                className="w-full rounded-full brand-gradient py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
              >
                Next
              </button>
            ) : (
              <button
                onClick={() => void finishTour(true)}
                className="w-full rounded-full brand-gradient py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
              >
                💗 Ring a Friend
              </button>
            )}
            <button
              onClick={() => void finishTour(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Skip tour
            </button>
          </div>
        </div>
      )}

      <input type="hidden" data-user-id={user.id} />
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  badge = 0,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className="relative flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
      activeProps={{ className: "text-foreground" }}
    >
      <span className="relative">
        {icon}
        {badge > 0 && (
          <span className="absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

