export type Level = { name: string; min: number; emoji: string };

export const LEVELS: Level[] = [
  { name: "Newbie", min: 0, emoji: "🌱" },
  { name: "Explorer", min: 50, emoji: "🧭" },
  { name: "Creator", min: 200, emoji: "🎨" },
  { name: "Influencer", min: 500, emoji: "🌟" },
  { name: "Legend", min: 1500, emoji: "👑" },
];

export function levelFor(points: number) {
  let current: Level = LEVELS[0];
  let next: Level | null = null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (points >= LEVELS[i].min) current = LEVELS[i];
    if (LEVELS[i].min > points) {
      next = LEVELS[i];
      break;
    }
  }
  const ceiling = next ? next.min : current.min + 500;
  const floor = current.min;
  const pct = Math.min(100, Math.round(((points - floor) / Math.max(1, ceiling - floor)) * 100));
  return { current, next, pct };
}
