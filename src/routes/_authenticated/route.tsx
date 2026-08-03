import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdsterraBanner } from "@/components/ifriend/AdsterraBanner";
import { AlarmRingModal } from "@/components/ifriend/AlarmRingModal";
import { ringCountFor } from "@/lib/ifriend/alarmSound";
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

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(!!data));
    // Onboarding gate
    const path = window.location.pathname;
    if (path === "/onboarding" || path === "/auth") return;
    (supabase as any)
      .from("profiles")
      .select("onboarded")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data && data.onboarded === false) {
          router.navigate({ to: "/onboarding", replace: true });
        }
      });
  }, [user.id, router]);

  // ── Live Heart Alarm ring (receiver side) ────────────────────────────────
  // Lifecycle per ring: pending → (shown once) → posting (/upload?reveal=id) → revealed.
const SEEN_KEY = "ha-seen-alarms";
const seenAlarm = (id: string) => {
  try {
    return (JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]") as string[]).includes(id);
  } catch {
    return false;
  }
};
const markAlarmSeen = (id: string) => {
  try {
    const arr = JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]") as string[];
    if (!arr.includes(id)) sessionStorage.setItem(SEEN_KEY, JSON.stringify([...arr, id]));
  } catch {
    /* noop */
  }
};

const [incomingAlarmId, setIncomingAlarmId] = useState<string | null>(null);
const [pendingAlarmId, setPendingAlarmId] = useState<string | null>(null);

const { data: pendingAlarms } = useQuery({
  queryKey: ["pending-heart-alarm", user.id],
  queryFn: async () => {
    const { data, error } = await (supabase as any)
      .from("heart_alarms")
      .select("id")
      .eq("receiver_id", user.id)
      .is("revealed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    return data ?? [];
  },
});

useEffect(() => {
  if (incomingAlarmId) return;
  if (!pendingAlarms || pendingAlarms.length === 0) return;
  const id = pendingAlarms[0].id as string;
  if (id === pendingAlarmId) return;
  setPendingAlarmId(id);
  // Show the full-screen ring only once per ring.
  if (seenAlarm(id)) return;
  markAlarmSeen(id);
  setIncomingAlarmId(id);
}, [pendingAlarms, incomingAlarmId, pendingAlarmId]);




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
        setPendingAlarmId(id);
        if (id && !seenAlarm(id)) {
          markAlarmSeen(id);
          setIncomingAlarmId(id);
        }
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
          const id = incomingAlarmId;
          setIncomingAlarmId(null);
          if (id) router.navigate({ to: "/upload", search: { reveal: id } });
        }}
        onLeave={() => setIncomingAlarmId(null)}
      />

      {!incomingAlarmId && pendingAlarmId && (
        <button
          onClick={() => setIncomingAlarmId(pendingAlarmId)}
          className="fixed left-1/2 top-3 z-40 -translate-x-1/2 rounded-full brand-gradient px-4 py-2 text-xs font-bold text-primary-foreground shadow-lg glow"
        >
          💗 A heart is waiting · tap to reveal
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

      <div className="fixed bottom-14 left-0 right-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <AdsterraBanner />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-1 py-2">
          <NavItem to="/" icon={<Home className="h-5 w-5" />} label="Home" />
          <NavItem to="/search" icon={<Search className="h-5 w-5" />} label="Search" />
          <NavItem to="/upload" icon={<PlusSquare className="h-5 w-5" />} label="Post" />
          
          <NavItem to="/inbox" icon={<MessageCircle className="h-5 w-5" />} label="Inbox" badge={unread} />
          <NavItem to="/me" icon={<User className="h-5 w-5" />} label="Me" />

        </div>
      </nav>

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

