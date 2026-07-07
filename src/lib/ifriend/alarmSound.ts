// Love Alarm–style sweet heartbeat + chime, generated via WebAudio.
// No external files. Safe to call from user gesture (click).
let ctx: AudioContext | null = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  const AC: typeof AudioContext | undefined =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function chime(ac: AudioContext, at: number, freq: number, dur: number, gain = 0.18) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 3200;
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(filter).connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

function thump(ac: AudioContext, at: number, gain = 0.35) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, at);
  osc.frequency.exponentialRampToValueAtTime(45, at + 0.18);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + 0.32);
}

/**
 * Plays a sweet Love Alarm–style sequence.
 * Returns a stop() cleanup fn.
 */
export function playHeartAlarm(rings = 1): () => void {
  const ac = getCtx();
  if (!ac) return () => {};
  const start = ac.currentTime + 0.02;
  // Sparkly two-note chime up front
  chime(ac, start, 880, 0.7, 0.14);
  chime(ac, start + 0.18, 1318.5, 0.9, 0.12);
  // Heartbeat pattern repeated for each ring
  const perRing = 1.15;
  for (let r = 0; r < rings; r++) {
    const base = start + 0.35 + r * perRing;
    thump(ac, base, 0.3);
    thump(ac, base + 0.22, 0.22);
    chime(ac, base + 0.55, 1046.5, 0.5, 0.09);
  }
  return () => {
    try {
      ac.close();
    } catch {
      /* noop */
    }
    ctx = null;
  };
}

/** Deterministic ring count per user: half → 1, quarter → 3, quarter → 5. */
export function ringCountFor(userId: string): 1 | 3 | 5 {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  const bucket = h % 4;
  if (bucket === 0) return 3;
  if (bucket === 1) return 5;
  return 1;
}
