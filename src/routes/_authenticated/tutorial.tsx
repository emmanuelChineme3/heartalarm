import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlarmRingModal } from "@/components/ifriend/AlarmRingModal";
import { requestContactsPermission, contactsSupported } from "@/lib/ifriend/ringFriends";
import { Button } from "@/components/ui/button";
import { BellRing, Heart, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tutorial")({
  head: () => ({ meta: [{ title: "Tutorial · Heart Alarm" }] }),
  component: TutorialPage,
});

// Purely local demo: nothing here calls the ring system, so no quota is used
// and no real user is ever rung.
const DEMO = { name: "Ava (demo)", username: "heartalarm_demo" };

type Step =
  | "welcome"
  | "incoming"
  | "ringing"
  | "reveal"
  | "rangback"
  | "yourturn"
  | "tapring"
  | "contacts"
  | "finish";

function TutorialPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [asking, setAsking] = useState(false);

  async function allowContacts() {
    if (asking) return;
    setAsking(true);
    try {
      if (contactsSupported()) await requestContactsPermission();
    } catch {
      /* user can still allow later from Ring a Friend */
    }
    setAsking(false);
    setStep("finish");
  }

  async function finish() {
    await (supabase as any).rpc("complete_tour").catch(() => undefined);
    router.navigate({ to: "/ring", replace: true });
  }

  if (step === "ringing") {
    return (
      <AlarmRingModal
        open
        rings={2}
        variant="receiver"
        onReveal={() => setStep("reveal")}
        onLeave={() => setStep("reveal")}
      />
    );
  }

  const card = (emoji: string, title: string, body: string, cta: string, next: () => void, extra?: React.ReactNode) => (
    <div className="space-y-5 text-center">
      <p className="text-5xl">{emoji}</p>
      <h1 className="text-2xl font-extrabold brand-text">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
      {extra}
      <Button onClick={next} disabled={asking} className="w-full brand-gradient text-primary-foreground">
        {asking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {cta}
      </Button>
    </div>
  );

  const order: Step[] = ["welcome", "incoming", "ringing", "reveal", "rangback", "yourturn", "tapring", "contacts", "finish"];
  const idx = order.indexOf(step);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center gap-1.5">
          {order.map((s, i) => (
            <span key={s} className={`h-1.5 rounded-full ${i === idx ? "w-5 bg-primary" : "w-1.5 bg-muted"}`} />
          ))}
        </div>

        {step === "welcome" &&
          card("💗", "Welcome to Heart Alarm", "Let's walk through your first Ring. This is a demo — it won't use your daily Rings.", "Start", () => setStep("incoming"))}

        {step === "incoming" && (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full brand-gradient text-primary-foreground glow">
              <BellRing className="h-10 w-10 heart-pulse" />
            </div>
            <h1 className="text-2xl font-extrabold brand-text">Incoming Ring…</h1>
            <p className="text-sm text-muted-foreground">Someone just rang your Heart Alarm. Tap to feel it.</p>
            <Button onClick={() => setStep("ringing")} className="w-full brand-gradient text-primary-foreground">
              Open the Ring
            </Button>
          </div>
        )}

        {step === "reveal" && (
          <div className="space-y-5 text-center">
            <h1 className="text-2xl font-extrabold brand-text">It was {DEMO.name}</h1>
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full brand-gradient text-4xl font-extrabold text-primary-foreground glow">
              A
            </div>
            <p className="text-sm text-muted-foreground">@{DEMO.username} · normally you'd post to reveal who rang you.</p>
            <Button onClick={() => setStep("rangback")} className="w-full brand-gradient text-primary-foreground">
              💗 Ring Back
            </Button>
          </div>
        )}

        {step === "rangback" &&
          card("🔔", "Ring sent!", `${DEMO.name} would now feel your Ring. Ring Back uses your normal 3 Rings a day — this demo didn't use any.`, "Next", () => setStep("yourturn"))}

        {step === "yourturn" &&
          card("✨", "Now send your first Ring", "Think of someone who has a heart for your vibe.", "Next", () => setStep("tapring"))}

        {step === "tapring" &&
          card("👆", "Tap to Ring a Friend", "On your feed, tap “Tap to ring a friend”, pick someone from your contacts and tap Ring. Friends not on Heart Alarm get a ring link.", "Next", () => setStep("contacts"),
            <div className="rounded-full brand-gradient px-4 py-3 text-sm font-bold text-primary-foreground glow">
              💗 Tap to ring a friend
            </div>)}

        {step === "contacts" &&
          card("📇", "Find your friends", "Allow contacts so you can ring friends. Matching happens on your phone — your address book is never uploaded.", "Allow contacts", allowContacts,
            <button onClick={() => setStep("finish")} className="text-xs text-muted-foreground hover:text-foreground">Not now</button>)}

        {step === "finish" &&
          card("🎉", "You're all set", "You can replay this tutorial anytime from Settings.", "💗 Ring a Friend", finish)}

        {step !== "finish" && (
          <button onClick={finish} className="mt-6 block w-full text-center text-xs text-muted-foreground hover:text-foreground">
            <Heart className="mr-1 inline h-3 w-3" /> Skip tutorial
          </button>
        )}
      </div>
    </div>
  );
}
