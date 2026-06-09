import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdsterraBanner } from "@/components/ifriend/AdsterraBanner";
import { Home, Search, PlusSquare, User, LogOut } from "lucide-react";

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

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-2xl font-extrabold tracking-tight brand-text">
            iFriend
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
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-40 pt-4">
        <Outlet />
      </main>

      <div className="fixed bottom-14 left-0 right-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <AdsterraBanner />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2">
          <NavItem to="/" icon={<Home className="h-6 w-6" />} label="Home" />
          <NavItem to="/search" icon={<Search className="h-6 w-6" />} label="Search" />
          <NavItem to="/upload" icon={<PlusSquare className="h-6 w-6" />} label="Post" />
          <NavItem to="/me" icon={<User className="h-6 w-6" />} label="Me" />
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
      className="flex flex-1 flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
      activeProps={{ className: "text-foreground" }}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
