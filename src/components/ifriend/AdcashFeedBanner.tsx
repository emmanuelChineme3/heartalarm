import { useEffect, useRef } from "react";

// Adcash Display 300x250 banner. The aclib.js library is loaded once in the
// root head; this component only asks it to render one banner into its own
// container. No Autotag, pop-ups or other formats are triggered here.
const ACASH_ZONE_ID = "12400042";

let libraryPromise: Promise<void> | null = null;

function ensureAclibLibrary(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as any;
  if (w.aclib) return Promise.resolve();
  if (!libraryPromise) {
    libraryPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-adcash-lib="1"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("aclib load failed")), { once: true });
        return;
      }
      const s = document.createElement("script");
      s.src = "https://acscdn.com/script/aclib.js";
      s.async = true;
      s.dataset.adcashLib = "1";
      s.addEventListener("load", () => resolve(), { once: true });
      s.addEventListener("error", () => reject(new Error("aclib load failed")), { once: true });
      document.head.appendChild(s);
    });
  }
  return libraryPromise;
}

export function AdcashFeedBanner() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    ensureAclibLibrary()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        // Render the banner inside this card's container only.
        const s = document.createElement("script");
        s.type = "text/javascript";
        s.text = `aclib.runBanner({ zoneId: '${ACASH_ZONE_ID}' });`;
        containerRef.current.appendChild(s);
      })
      .catch((err) => console.warn("[adcash] banner load failed", err));

    return () => {
      cancelled = true;
    };
  }, []);

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
        className="flex min-h-[250px] w-full items-center justify-center overflow-hidden"
      />
    </div>
  );
}
