import { useEffect, useRef, useState } from "react";

// Adsterra Native Banner (publisher 3327944, unit 6173359).
// The invoke script scans the page for the container id and fills every
// unfilled container it finds. New containers added later (feed scrolling)
// need the script re-executed, so we invoke it once per new container,
// serialized, and only when an unfilled container actually exists.
const ADSTERRA_KEY = "3057c0c00d009161099490da35b41e70";
const INVOKE_SRC = `https://pl32181094.profitableratecpmnetwork.com/${ADSTERRA_KEY}/invoke.js`;
const CONTAINER_ID = `container-${ADSTERRA_KEY}`;

function invokeAdsterra(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = INVOKE_SRC;
    s.async = true;
    s.setAttribute("data-cfasync", "false");
    s.dataset.adsterraInvoke = "1";
    s.addEventListener("load", () => resolve(), { once: true });
    s.addEventListener("error", () => reject(new Error("adsterra invoke load failed")), { once: true });
    document.body.appendChild(s);
  });
}

let invokeChain: Promise<void> = Promise.resolve();

function requestInvoke(): Promise<void> {
  const run = invokeChain.then(() => {
    // Skip when every container was already filled by a previous invoke.
    if (!document.querySelector(`[id="${CONTAINER_ID}"]`)) return;
    return invokeAdsterra().catch((err) => {
      console.warn("[adsterra] banner load failed", err);
      throw err;
    });
  });
  // Keep the chain alive even when one invoke fails.
  invokeChain = run.catch(() => undefined);
  return run;
}

export function AdsterraFeedCard() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    // If nothing has rendered into the container, collapse the card instead
    // of showing an empty "Sponsored" slot.
    const timer = window.setTimeout(() => {
      if (!cancelled && containerRef.current && containerRef.current.childElementCount === 0) {
        setFailed(true);
      }
    }, 20000);

    requestInvoke().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (failed) return null;

  return (
    <div
      aria-label="Sponsored"
      className="overflow-hidden rounded-3xl border border-border bg-card"
    >
      <div className="flex items-center justify-between px-4 pt-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sponsored
        </span>
      </div>
      <div
        ref={containerRef}
        id={CONTAINER_ID}
        className="flex w-full items-center justify-center overflow-hidden"
      />
    </div>
  );
}
