import { useEffect } from "react";
import { Radio } from "lucide-react";

/**
 * Sender-side confirmation: a glowing radar emitting expanding waves.
 * Auto-dismisses after ~1.6s. Intentionally different from the
 * receiver's Heart Alarm ringing experience.
 */
export function RingSentOverlay({
  open,
  onDone,
  duration = 1600,
}: {
  open: boolean;
  onDone: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!open) return;
    try {
      navigator.vibrate?.(40);
    } catch {
      /* noop */
    }
    const t = window.setTimeout(onDone, duration);
    return () => window.clearTimeout(t);
  }, [open, duration, onDone]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 px-6 text-center animate-in fade-in-0"
      style={{
        background:
          "radial-gradient(circle at 50% 45%, rgba(255,92,138,0.35) 0%, rgba(20,6,16,0.96) 60%, rgba(10,4,10,0.98) 100%)",
      }}
    >
      <div className="relative flex h-[260px] w-[260px] items-center justify-center">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="absolute rounded-full border border-primary/60"
            style={{
              width: 90,
              height: 90,
              animation: `rsWave 1.6s ease-out ${i * 0.28}s infinite`,
            }}
          />
        ))}
        <div
          className="relative flex h-[96px] w-[96px] items-center justify-center rounded-full brand-gradient"
          style={{
            boxShadow:
              "0 0 60px rgba(255,92,138,0.65), inset 0 -8px 20px rgba(0,0,0,0.2)",
            animation: "rsPulse 1.2s ease-in-out infinite",
          }}
        >
          <Radio className="h-11 w-11 text-primary-foreground" />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-3xl font-extrabold tracking-tight text-foreground">Ring Sent</p>
        <p className="text-sm text-muted-foreground">Your signal is on its way…</p>
      </div>

      <style>{`
        @keyframes rsWave {
          0%   { transform: scale(1);   opacity: 0.85; }
          100% { transform: scale(2.7); opacity: 0; }
        }
        @keyframes rsPulse {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.07); }
        }
      `}</style>
    </div>
  );
}
