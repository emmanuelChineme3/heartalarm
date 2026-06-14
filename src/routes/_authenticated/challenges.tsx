import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Check, Loader2, Zap } from "lucide-react";
import { levelFor } from "@/lib/ifriend/levels";

export const Route = createFileRoute("/_authenticated/challenges")({
  component: ChallengesPage,
});

type Challenge = {
  id: string; key: string; title: string; description: string;
  kind: "daily" | "weekly"; points: number; emoji: string | null;
};

function ChallengesPage() {
  const { user } = Route.useRouteContext();

  const { data, isLoading } = useQuery({
    queryKey: ["challenges", user.id],
    queryFn: async () => {
      const [{ data: ch }, { data: done }, { data: prof }] = await Promise.all([
        (supabase as any).from("challenges").select("*").order("kind").order("points"),
        (supabase as any).from("challenge_completions").select("challenge_id").eq("user_id", user.id),
        (supabase as any).from("profiles").select("points").eq("id", user.id).maybeSingle(),
      ]);
      const completed = new Set((done ?? []).map((c: any) => String(c.challenge_id)));
      return {
        challenges: (ch ?? []) as Challenge[],
        completed,
        points: prof?.points ?? 0,
      };
    },
  });

  if (isLoading || !data) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  const { current, next, pct } = levelFor(data.points);

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <span className="rounded-full brand-gradient p-2 text-primary-foreground glow">
            <Trophy className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-lg font-bold brand-text">Challenges</h1>
            <p className="text-xs text-muted-foreground">Earn points, level up, unlock more Heart visibility.</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-muted/40 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">{current.emoji} {current.name}</span>
            <span className="text-xs text-muted-foreground">
              {data.points} pts{next ? ` · ${next.min - data.points} to ${next.name}` : ""}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
            <div className="h-full brand-gradient" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <Section title="Daily" items={data.challenges.filter((c) => c.kind === "daily")} completed={data.completed} />
      <Section title="Weekly" items={data.challenges.filter((c) => c.kind === "weekly")} completed={data.completed} />
    </div>
  );
}

function Section({ title, items, completed }: { title: string; items: Challenge[]; completed: Set<string> }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      <ul className="space-y-2">
        {items.map((c) => {
          const done = completed.has(c.id);
          return (
            <li key={c.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
                {c.emoji ?? "✨"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{c.title}</span>
                  {done && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      <Check className="h-3 w-3" /> Done
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{c.description}</p>
                <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                  <Zap className="h-3 w-3" /> {c.points} pts
                </div>
              </div>
              {!done && (
                <Link
                  to="/upload"
                  className="rounded-full brand-gradient px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Do it
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
