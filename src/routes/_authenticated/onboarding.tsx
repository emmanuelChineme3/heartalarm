import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VIBES } from "@/lib/ifriend/vibes";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BellRing, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("profiles").select("onboarded, vibes").eq("id", user.id).maybeSingle();
      if (data?.onboarded) {
        router.navigate({ to: "/", replace: true });
        return;
      }
      if (Array.isArray(data?.vibes)) setPicked(data.vibes);
      setChecking(false);
    })();
  }, [user.id, router]);

  function toggle(k: string) {
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  }

  async function finish() {
    if (picked.length === 0) return toast.error("Pick at least one vibe");
    setBusy(true);
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ vibes: picked, onboarded: true })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error("Couldn't save");
    toast.success("Welcome to Heart Alarm ❤️🔔");
    router.navigate({ to: "/", replace: true });
  }

  if (checking) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full brand-gradient text-primary-foreground glow">
          <BellRing className="h-7 w-7 heart-pulse" />
        </div>
        <h1 className="mt-3 text-2xl font-extrabold brand-text">Welcome to Heart Alarm</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick the vibes you love. We'll personalize your feed.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {VIBES.map((v) => {
          const on = picked.includes(v.key);
          return (
            <button
              key={v.key}
              onClick={() => toggle(v.key)}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                on ? "border-transparent brand-gradient text-primary-foreground" : "border-border bg-card hover:border-primary"
              }`}
            >
              <span className="text-lg">{v.emoji}</span> {v.label}
            </button>
          );
        })}
      </div>

      <Button
        onClick={finish}
        disabled={busy}
        className="w-full brand-gradient text-primary-foreground"
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Start feeling the vibe
      </Button>
    </div>
  );
}
