import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/ifriend/SignedImage";
import { Button } from "@/components/ui/button";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reveal/$id")({
  component: RevealPage,
});

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

function RevealPage() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [ringing, setRinging] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["reveal", id],
    queryFn: async () => {
      const { data: alarm } = await (supabase as any)
        .from("heart_alarms")
        .select("id, sender_id, virtual_sender_id")
        .eq("id", id)
        .maybeSingle();
      const admirerId = alarm?.sender_id ?? alarm?.virtual_sender_id ?? null;
      const ids = [user.id, admirerId].filter(Boolean) as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", ids);
      const list = (profiles as Profile[] | null) ?? [];
      return {
        me: list.find((p) => p.id === user.id) ?? null,
        admirer: list.find((p) => p.id === admirerId) ?? null,
      };
    },
  });

  useEffect(() => {
    const t = window.setTimeout(() => setConnected(true), 500);
    return () => window.clearTimeout(t);
  }, []);

  async function ringBack() {
    if (!data?.admirer) return;
    setRinging(true);
    const { error } = await (supabase as any).from("heart_alarms").insert({
      receiver_id: data.admirer.id,
      sender_id: user.id,
      kind: "manual",
    });
    setRinging(false);
    if (error) toast.error("Couldn't ring back");
    else toast.success("💗 You rang them back!");
  }

  const admirer = data?.admirer;
  const name = admirer?.display_name ?? admirer?.username ?? "Someone";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between px-6 py-12 text-center"
      style={{
        background:
          "linear-gradient(180deg,#2ec5e8 0%,#5aa8f0 35%,#a45cf0 70%,#e040c9 100%)",
      }}
    >
      <div>
        <h1
          className="text-2xl font-extrabold text-white"
          style={{ textShadow: "0 2px 20px rgba(255,255,255,0.4)" }}
        >
          Your Heart Alarm rang
        </h1>
        <p className="mt-1 text-sm text-white/85">Here's who has a heart for your vibe</p>
      </div>

      {isLoading ? (
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      ) : (
        <div className="flex flex-col items-center">
          {/* me */}
          <div className="rounded-full ring-4 ring-white/70">
            <Avatar path={data?.me?.avatar_url} name={data?.me?.username ?? "You"} size={86} />
          </div>

          {/* connecting line */}
          <div className="relative my-2 h-24 w-[3px] overflow-hidden rounded-full bg-white/25">
            <span
              className="absolute left-0 top-0 w-full bg-white"
              style={{
                height: connected ? "100%" : "0%",
                transition: "height 900ms ease-out",
                boxShadow: "0 0 14px rgba(255,255,255,0.9)",
              }}
            />
          </div>

          {/* admirer */}
          <div
            className="relative rounded-full ring-4 ring-white"
            style={{
              transform: connected ? "scale(1)" : "scale(0.7)",
              opacity: connected ? 1 : 0,
              transition: "all 700ms cubic-bezier(.2,.9,.3,1.4) 700ms",
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
            }}
          >
            <Avatar path={admirer?.avatar_url} name={name} size={150} />
          </div>

          <Heart
            className="mt-6 text-white"
            style={{ width: 44, height: 44, animation: "haBeat2 1.1s ease-in-out infinite" }}
            fill="currentColor"
          />

          <p className="mt-4 text-2xl font-extrabold text-white">{name}</p>
          {admirer && <p className="text-sm text-white/85">@{admirer.username}</p>}
        </div>
      )}

      <div className="w-full max-w-sm space-y-3">
        {admirer && (
          <Link to="/p/$username" params={{ username: admirer.username }}>
            <Button
              size="lg"
              className="w-full rounded-full bg-white/95 py-6 text-base font-bold text-[#a13fd0] hover:bg-white"
            >
              View profile
            </Button>
          </Link>
        )}
        <Button
          onClick={ringBack}
          disabled={ringing || !admirer}
          size="lg"
          variant="outline"
          className="w-full rounded-full border-white/70 bg-white/10 py-6 text-base font-bold text-white hover:bg-white/20 hover:text-white"
        >
          {ringing ? "Ringing…" : "🔔 Ring them back"}
        </Button>
        <button
          onClick={() => router.navigate({ to: "/" })}
          className="w-full text-sm text-white/85 underline-offset-4 hover:underline"
        >
          Back to feed
        </button>
      </div>

      <style>{`
        @keyframes haBeat2 {
          0%,100% { transform: scale(1); }
          25%     { transform: scale(1.18); }
          40%     { transform: scale(0.96); }
          60%     { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
