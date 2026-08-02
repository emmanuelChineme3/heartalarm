import { useEffect, useState } from "react";
import { Heart, X } from "lucide-react";
import { playHeartAlarm } from "@/lib/ifriend/alarmSound";
import { Button } from "@/components/ui/button";

/**
 * Love-Alarm-style ring screen.
 * Pastel gradient bg, glowing pink heart button, expanding rings, sweet chime.
 */
export function AlarmRingModal({
  open,
  rings,
  variant = "receiver",
  onReveal,
  onLeave,
}: {
  open: boolean;
  rings: number;
  /** "receiver" = someone rang you (has Reveal). "sender" = you rang someone (confirmation only). */
  variant?: "receiver" | "sender";
  onReveal?: () => void;
  onLeave: () => void;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReady(false);
    const stop = playHeartAlarm(rings);
    // Haptic buzz pattern matching the ring count
    try {
      const pattern: number[] = [];
      for (let i = 0; i < rings; i++) pattern.push(220, 140, 160, 380);
      navigator.vibrate?.(pattern);
    } catch {
      /* noop */
    }
    const t = window.setTimeout(() => setReady(true), 2600);
    return () => {
      window.clearTimeout(t);
      try {
        navigator.vibrate?.(0);
      } catch {
        /* noop */
      }
      stop();
    };
  }, [open, rings]);

  if (!open) return null;

  const title = "Heart Alarm";
  const headline =
    variant === "sender"
      ? "You sent a Heart Alarm"
      : "Someone, somewhere has a\u00A0heart for your vibe";
  const sub =
    variant === "sender"
      ? "They'll feel it ringing right now 💗"
      : "Your Heart Alarm is ringing 💗";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between px-6 py-10 text-center animate-in fade-in-0"
      style={{
        background:
          "linear-gradient(180deg,#a7ecec 0%,#c9e9ef 30%,#ffd4e0 65%,#ffc2d4 100%)",
      }}
    >
      {/* close */}
      <button
        onClick={onLeave}
        aria-label="Close"
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/35 text-white/90 backdrop-blur-md transition hover:bg-white/50"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Title */}
      <h2
        className="mt-4 text-2xl font-extrabold tracking-tight text-white"
        style={{ textShadow: "0 2px 20px rgba(255,255,255,0.55)" }}
      >
        {title}
      </h2>

      {/* Heart with concentric rings */}
      <div className="relative flex h-[300px] w-[300px] items-center justify-center">
        {/* concentric rings */}
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="absolute rounded-full border border-white/55"
            style={{
              width: 120 + i * 55,
              height: 120 + i * 55,
              animation: `haRing 2.4s ease-out ${i * 0.6}s infinite`,
              opacity: 0.9 - i * 0.15,
            }}
          />
        ))}
        {/* central pink button */}
        <div
          className="relative flex h-[150px] w-[150px] items-center justify-center rounded-full"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, #ff89a8 0%, #ff5c8a 45%, #e83f75 100%)",
            boxShadow:
              "0 20px 50px rgba(232,63,117,0.55), inset 0 -10px 25px rgba(0,0,0,0.15), 0 0 60px rgba(255,92,138,0.55)",
            animation: "haBeat 1.1s ease-in-out infinite",
          }}
        >
          <Heart
            className="text-white"
            style={{
              width: 70,
              height: 70,
              filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.15))",
            }}
            fill="currentColor"
          />
        </div>
      </div>

      {/* Message */}
      <div className="w-full max-w-sm space-y-6 pb-2">
        <div>
          <p
            className="text-2xl font-extrabold leading-snug text-white"
            style={{ textShadow: "0 2px 16px rgba(255,255,255,0.5)" }}
          >
            {headline}
          </p>
          <p className="mt-3 text-sm text-white/85">{sub}</p>
          <p className="mt-1 text-xs text-white/70">
            {rings} ring{rings > 1 ? "s" : ""} · a strong signal
          </p>
        </div>

        {variant === "receiver" && onReveal && (
          <div className="flex flex-col items-center gap-3">
            <Button
              onClick={onReveal}
              size="lg"
              className="w-full rounded-full bg-white/95 px-8 py-6 text-base font-bold text-[#e83f75] shadow-lg hover:bg-white"
            >
              ❤️ Post to reveal admirer
            </Button>
            <button
              onClick={onLeave}
              className="text-sm text-white/85 underline-offset-4 hover:underline"
            >
              Maybe later
            </button>
          </div>
        )}

        {variant === "sender" && (
          <Button
            onClick={onLeave}
            size="lg"
            className="w-full rounded-full bg-white/95 px-8 py-6 text-base font-bold text-[#e83f75] shadow-lg hover:bg-white"
          >
            Done
          </Button>
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
    </div>
  );
}
