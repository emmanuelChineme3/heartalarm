import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdsterraBanner } from "@/components/ifriend/AdsterraBanner";
import { Home, Search, PlusSquare, User, LogOut, MessageCircle, UserPlus, Shield, Users, BellRing, Trophy } from "lucide-react";

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

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
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
          <NavItem to="/alarms" icon={<BellRing className="h-5 w-5" />} label="Alarms" />
          <NavItem to="/upload" icon={<PlusSquare className="h-5 w-5" />} label="Post" />
          
          <NavItem to="/inbox" icon={<MessageCircle className="h-5 w-5" />} label="Inbox" />
          <NavItem to="/me" icon={<User className="h-5 w-5" />} label="Me" />
        </div>
      </nav>

      <input type="hidden" data-user-id={user.id} />
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
      activeProps={{ className: "text-foreground" }}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
