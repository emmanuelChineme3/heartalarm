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
    gradient: "linear-gradient(135deg,#ff2d78,#ff8fc4,#ff2d78,#ffb3d9)",
    glow: "0 0 42px rgba(255,45,120,0.95), 0 0 18px rgba(255,143,196,0.9)",
    animated: true,
  },
  {
    id: "purple",
    name: "Purple Dream",
    className: "border-anim",
    gradient: "linear-gradient(135deg,#a855f7,#ec4899,#8b5cf6,#c084fc)",
    glow: "0 0 42px rgba(168,85,247,0.95), 0 0 18px rgba(236,72,153,0.85)",
    animated: true,
  },
  {
    id: "blue",
    name: "Blue Wave",
    className: "border-anim",
    gradient: "linear-gradient(135deg,#22d3ee,#3b82f6,#06b6d4,#60a5fa)",
    glow: "0 0 42px rgba(56,189,248,0.95), 0 0 18px rgba(96,165,250,0.85)",
    animated: true,
  },
  {
    id: "gold",
    name: "Gold Luxe",
    className: "border-anim",
    gradient: "linear-gradient(135deg,#fbbf24,#fef08a,#f59e0b,#fde047)",
    glow: "0 0 44px rgba(251,191,36,1), 0 0 20px rgba(253,224,71,0.9)",
    animated: true,
  },
  {
    id: "red",
    name: "Crimson Heart",
    className: "border-anim",
    gradient: "linear-gradient(135deg,#f43f5e,#ef4444,#ff1744,#fb7185)",
    glow: "0 0 46px rgba(244,63,94,1), 0 0 20px rgba(239,68,68,0.9)",
    animated: true,
  },
  {
    id: "green",
    name: "Neon Mint",
    className: "border-anim",
    gradient: "linear-gradient(135deg,#4ade80,#22d3ee,#34d399,#a7f3d0)",
    glow: "0 0 42px rgba(74,222,128,0.95), 0 0 18px rgba(34,211,238,0.85)",
    animated: true,
  },
  {
    id: "rainbow",
    name: "Rainbow",
    className: "border-anim",
    gradient:
      "linear-gradient(135deg,#ff2d78,#ff6b00,#facc15,#22c55e,#06b6d4,#8b5cf6,#ff2d78)",
    glow: "0 0 44px rgba(255,255,255,0.7), 0 0 22px rgba(236,72,153,0.85)",
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
