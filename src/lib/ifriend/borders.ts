// Post border styles for Heart Alarm.
// Each style renders as a padded gradient wrapper around the post media.
export type BorderStyle = {
  id: string;
  name: string;
  className: string; // extra classes for the outer wrapper
  gradient: string; // CSS background gradient
  glow?: string;
  animated?: boolean;
};

export const BORDER_STYLES: BorderStyle[] = [
  { id: "none", name: "None", className: "", gradient: "transparent" },
  {
    id: "pink",
    name: "Pink Aura",
    className: "border-anim",
    gradient: "linear-gradient(135deg,#ff5c8a,#ff9ecd,#ff5c8a)",
    glow: "0 0 24px rgba(255,92,138,0.55)",
    animated: true,
  },
  {
    id: "purple",
    name: "Purple Dream",
    className: "border-anim",
    gradient: "linear-gradient(135deg,#8b5cf6,#d946ef,#6366f1)",
    glow: "0 0 24px rgba(168,85,247,0.5)",
    animated: true,
  },
  {
    id: "blue",
    name: "Blue Wave",
    className: "border-anim",
    gradient: "linear-gradient(135deg,#38bdf8,#6366f1,#22d3ee)",
    glow: "0 0 24px rgba(59,130,246,0.5)",
    animated: true,
  },
  {
    id: "gold",
    name: "Gold Luxe",
    className: "border-anim",
    gradient: "linear-gradient(135deg,#f59e0b,#fde68a,#f59e0b,#b45309)",
    glow: "0 0 24px rgba(245,158,11,0.55)",
    animated: true,
  },
  {
    id: "red",
    name: "Crimson Heart",
    className: "border-anim",
    gradient: "linear-gradient(135deg,#ef4444,#f43f5e,#ef4444)",
    glow: "0 0 26px rgba(244,63,94,0.6)",
    animated: true,
  },
  {
    id: "green",
    name: "Neon Mint",
    className: "border-anim",
    gradient: "linear-gradient(135deg,#34d399,#22d3ee,#34d399)",
    glow: "0 0 22px rgba(52,211,153,0.5)",
    animated: true,
  },
  {
    id: "rainbow",
    name: "Rainbow",
    className: "border-anim",
    gradient:
      "linear-gradient(135deg,#ff5c8a,#f59e0b,#facc15,#34d399,#38bdf8,#8b5cf6,#ff5c8a)",
    glow: "0 0 26px rgba(255,255,255,0.35)",
    animated: true,
  },
];

export function getBorder(id: string | null | undefined) {
  return BORDER_STYLES.find((b) => b.id === (id ?? "none")) ?? BORDER_STYLES[0];
}

export function borderWrapperStyle(id: string | null | undefined): React.CSSProperties {
  const b = getBorder(id);
  if (b.id === "none") return {};
  return {
    padding: 3,
    background: b.gradient,
    backgroundSize: "200% 200%",
    boxShadow: b.glow,
    borderRadius: 24,
  };
}
