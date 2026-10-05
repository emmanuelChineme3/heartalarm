import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { playHeartAlarm } from "@/lib/ifriend/alarmSound";
import { RING_LINK_STORAGE_KEY } from "@/lib/ifriend/ringFriends";

export const Route = createFileRoute("/r/$token")({
  component: WebRing,
  head: () => ({
    meta: [
      { title: "Someone sent you a Heart Alarm 💗" },
      {
        name: "description",
        content:
          "Someone, somewhere has a heart for your vibe. Open your Heart Alarm and reveal who is ringing.",
      },
      { property: "og:title", content: "Someone sent you a Heart Alarm 💗" },
      {
        property: "og:description",
        content: "Someone, somewhere has a heart for your vibe. Tap to reveal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type RingLink = {
  contact_name: string | null;
  message: string | null;
  sender_display_name: string | null;
  sender_username: string | null;
  sender_avatar_url: string | null;
};

function WebRing() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [revealed, setRevealed] = useState(false);
  const [ready, setReady] = useState(false);

  const { data } = useQuery({
    queryKey: ["ring-link", token],
    queryFn: async (): Promise<RingLink | null> => {
      const { data } = await (supabase as any).rpc("get_ring_link", { _token: token });
      return (data?.[0] as RingLink) ?? null;
    },
  });

  const [started, setStarted] = useState(false);

  // Browsers block sound until the visitor taps, so the ring starts on the
  // first tap and keeps ringing until they reveal.
  useEffect(() => {
    if (!started || revealed) return;
    let stop = playHeartAlarm(3);
    try {
      navigator.vibrate?.([220, 140, 160, 380, 220, 140]);
    } catch {
      /* noop */
    }
    const loop = window.setInterval(() => {
      stop = playHeartAlarm(3);
    }, 4200);
    const t = window.setTimeout(() => setReady(true), 1500);
    return () => {
      window.clearInterval(loop);
      window.clearTimeout(t);
      stop();
    };
  }, [started, revealed]);

  function join() {
    try {
      localStorage.setItem(RING_LINK_STORAGE_KEY, token);
    } catch {
      /* noop */
    }
    navigate({ to: "/auth" });
  }

  const sender = data?.sender_display_name ?? "Someone";
  const forName = data?.contact_name;

  return (
    <main
      className="fixed inset-0 z-50 flex flex-col items-center justify-between overflow-y-auto px-6 py-10 text-center"
      style={{
        background:
          "linear-gradient(180deg,#a7ecec 0%,#c9e9ef 30%,#ffd4e0 65%,#ffc2d4 100%)",
      }}
    >
      {!started && (
        <button
          onClick={() => setStarted(true)}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 text-center"
          style={{ background: "rgba(232,63,117,0.88)" }}
        >
          <Heart className="h-20 w-20 text-white" fill="currentColor" style={{ animation: "haBeat 1.1s ease-in-out infinite" }} />
          <span className="text-2xl font-extrabold text-white">Your Heart Alarm is ringing</span>
          <span className="rounded-full bg-white/95 px-8 py-4 text-base font-bold text-[#e83f75]">💗 Tap to answer</span>
        </button>
      )}
      <h1
        className="text-2xl font-extrabold tracking-tight text-white"
        style={{ textShadow: "0 2px 20px rgba(255,255,255,0.55)" }}
      >
        Heart Alarm
      </h1>

      <div className="relative flex h-[290px] w-[290px] items-center justify-center">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="absolute rounded-full border border-white/55"
            style={{
              width: 120 + i * 52,
              height: 120 + i * 52,
              animation: `haRing 2.4s ease-out ${i * 0.6}s infinite`,
              opacity: 0.9 - i * 0.15,
            }}
          />
        ))}
        <div
          className="relative flex h-[148px] w-[148px] items-center justify-center overflow-hidden rounded-full"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, #ff89a8 0%, #ff5c8a 45%, #e83f75 100%)",
            boxShadow:
              "0 20px 50px rgba(232,63,117,0.55), 0 0 60px rgba(255,92,138,0.55)",
            animation: "haBeat 1.1s ease-in-out infinite",
          }}
        >
          {revealed && data?.sender_avatar_url ? (
            <img src={data.sender_avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Heart className="h-[68px] w-[68px] text-white" fill="currentColor" />
          )}
        </div>
      </div>

      <div className="w-full max-w-sm space-y-6 pb-4">
        {!revealed ? (
          <>
            <div>
              <p
                className="text-2xl font-extrabold leading-snug text-white"
                style={{ textShadow: "0 2px 16px rgba(255,255,255,0.5)" }}
              >
                Someone, somewhere has a heart for your vibe
              </p>
              <p className="mt-3 text-sm text-white/85">
                {forName ? `This Heart Alarm is ringing for ${forName} 💗` : "Your Heart Alarm is ringing 💗"}
              </p>
            </div>
            <Button
              onClick={() => setRevealed(true)}
              size="lg"
              disabled={!ready}
              className="w-full rounded-full bg-white/95 px-8 py-6 text-base font-bold text-[#e83f75] shadow-lg transition hover:bg-white disabled:opacity-60"
            >
              <Sparkles className="mr-2 h-5 w-5" /> Reveal
            </Button>
          </>
        ) : (
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 space-y-5">
            <div>
              <p
                className="text-2xl font-extrabold leading-snug text-white"
                style={{ textShadow: "0 2px 16px rgba(255,255,255,0.5)" }}
              >
                {sender} sent you a Heart Alarm
              </p>
              <p className="mt-3 text-sm text-white/90">
                {data?.message ??
                  "They wanted you to feel this ring. Join Heart Alarm to ring them back 💗"}
              </p>
              {data?.sender_username && (
                <p className="mt-1 text-xs text-white/75">@{data.sender_username}</p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <Button
                onClick={join}
                size="lg"
                className="w-full rounded-full bg-white/95 px-8 py-6 text-base font-bold text-[#e83f75] shadow-lg hover:bg-white"
              >
                💗 Join Heart Alarm
              </Button>
              <Button
                onClick={join}
                size="lg"
                variant="outline"
                className="w-full rounded-full border-white/70 bg-white/10 px-8 py-6 text-base font-bold text-white hover:bg-white/20 hover:text-white"
              >
                <Download className="mr-2 h-5 w-5" /> Download the App
              </Button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes haRing {
          0%   { transform: scale(0.6); opacity: 0.9; }
          80%  { opacity: 0.15; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes haBeat {
          0%,100% { transform: scale(1); }
          25%     { transform: scale(1.08); }
          40%     { transform: scale(0.98); }
          60%     { transform: scale(1.05); }
        }
      `}</style>
    </main>
  );
}
