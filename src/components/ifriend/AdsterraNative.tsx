import { useEffect, useRef } from "react";

const SCRIPT_SRC =
  "https://pl29694470.effectivecpmnetwork.com/12c770a36d66b3441408b3bd35c5b8b7/invoke.js";
const CONTAINER_ID = "container-12c770a36d66b3441408b3bd35c5b8b7";

/**
 * Adsterra native banner. Loads the invoke script once globally.
 * Renders inside a labelled, spaced card so it doesn't break feed flow.
 */
export function AdsterraNative({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Inject the script only once globally
    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.setAttribute("data-cfasync", "false");
      document.body.appendChild(s);
    }
  }, []);

  return (
    <aside
      aria-label="Sponsored"
      className={`overflow-hidden rounded-3xl border border-border bg-card p-3 ${className}`}
    >
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Sponsored
      </div>
      <div ref={ref} id={CONTAINER_ID} className="min-h-[100px] w-full" />
    </aside>
  );
}
