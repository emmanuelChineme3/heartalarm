import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VIBES } from "@/lib/ifriend/vibes";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { registerPushNotifications } from "@/lib/ifriend/pushRegister";
import { requestRingNotificationPermission } from "@/lib/ifriend/ringNotify";
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
  const [step, setStep] = useState<"notify" | "vibes">("notify");
  const [asking, setAsking] = useState(false);

  async function allowNotifications() {
    if (asking) return;
    setAsking(true);
    try {
      // Raises the real Android POST_NOTIFICATIONS prompt (or browser prompt on web).
      const st = await registerPushNotifications();
      if (st.status === "not-native") await requestRingNotificationPermission();
    } catch { /* continue regardless */ }
    setAsking(false);
    setStep("vibes");
  }

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
    // First-time interactive tutorial (demo only, no real rings used).
    router.navigate({ to: "/tutorial", replace: true });
  }

  if (checking) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (step === "notify") {
    return (
      <div className="space-y-6 py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full brand-gradient text-primary-foreground glow">
          <BellRing className="h-8 w-8 heart-pulse" />
        </div>
        <h1 className="text-2xl font-extrabold brand-text">Never miss a Ring 💗</h1>
        <p className="text-sm text-muted-foreground">
          Allow Heart Alarm to notify you when someone rings you or sends you a message.
        </p>
        <Button onClick={allowNotifications} disabled={asking} className="w-full brand-gradient text-primary-foreground">
          {asking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Next
        </Button>
      </div>
    );
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
