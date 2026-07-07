import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { playHeartAlarm } from "@/lib/ifriend/alarmSound";
import { Button } from "@/components/ui/button";

/** Full-screen Love Alarm–style ring. */
export function AlarmRingModal({
  open,
  rings,
  onReveal,
  onLeave,
}: {
  open: boolean;
  rings: number;
  onReveal: () => void;
  onLeave: () => void;
}) {
  const [phase, setPhase] = useState<"ringing" | "choose">("ringing");

  useEffect(() => {
    if (!open) return;
    setPhase("ringing");
    const stop = playHeartAlarm(rings);
    const dur = Math.min(6000, 1200 + rings * 1200);
    const t = setTimeout(() => setPhase("choose"), dur);
    return () => {
      clearTimeout(t);
      stop();
    };
  }, [open, rings]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <Heart
            key={i}
            className="absolute text-primary/60"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              width: 24 + (i % 4) * 10,
              height: 24 + (i % 4) * 10,
              animation: `floatHeart ${4 + (i % 5)}s ease-in-out ${i * 0.2}s infinite`,
              filter: "drop-shadow(0 0 12px rgba(255,92,138,0.7))",
            }}
            fill="currentColor"
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        <div className="relative">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle,rgba(255,92,138,0.6) 0%,rgba(255,92,138,0) 70%)",
              animation: "alarmPulse 1.2s ease-out infinite",
              width: 260,
              height: 260,
              left: -130,
              top: -130,
            }}
          />
          <Heart
            className="text-primary"
            style={{
              width: 160,
              height: 160,
              filter: "drop-shadow(0 0 40px rgba(255,92,138,0.9))",
              animation: "heartBeat 0.9s ease-in-out infinite",
            }}
            fill="currentColor"
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-white">Heart Alarm</h2>
          <p className="max-w-xs text-base text-white/85">
            Someone somewhere has a heart for your vibe.
          </p>
          <p className="text-sm text-white/60">
            {rings} ring{rings > 1 ? "s" : ""} · a strong signal
          </p>
        </div>

        {phase === "choose" && (
          <div className="flex flex-col items-center gap-3 pt-2 animate-in fade-in-50">
            <Button
              onClick={onReveal}
              className="brand-gradient text-primary-foreground px-8 py-6 text-base font-semibold glow"
              size="lg"
            >
              ❤️ Reveal admirer
            </Button>
            <button
              onClick={onLeave}
              className="text-sm text-white/70 hover:text-white"
            >
              Leave for now
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes alarmPulse {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes heartBeat {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.18); }
          40% { transform: scale(0.98); }
          60% { transform: scale(1.12); }
        }
        @keyframes floatHeart {
          0%,100% { transform: translateY(0) scale(1); opacity: 0.35; }
          50% { transform: translateY(-30px) scale(1.15); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}
