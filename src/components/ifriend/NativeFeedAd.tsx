import { useEffect, useRef, useState } from "react";
import {
  hideNativeFeedAd,
  moveNativeFeedAd,
  nativeAdBridge,
  showNativeFeedAd,
} from "@/lib/ifriend/admob";

const AD_HEIGHT = 320;

/**
 * Reserves space in the feed for a Google AdMob native ad. The ad itself is a
 * real NativeAdView rendered natively on top of the WebView at this element's
 * position — assets, impressions and clicks are all handled by the Google SDK
 * (nothing is copied into HTML). Renders nothing on web, where no SDK exists.
 */
export function NativeFeedAd() {
  const ref = useRef<HTMLDivElement | null>(null);
  const idRef = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!nativeAdBridge()) return;
    let alive = true;
    let raf = 0;
    let last = "";

    const rectOf = () => {
      const el = ref.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    };

    const sync = () => {
      raf = 0;
      const id = idRef.current;
      const rect = rectOf();
      if (!id || !rect) return;
      const visible = rect.y + rect.height > 0 && rect.y < window.innerHeight;
      const key = `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.width)},${visible}`;
      if (key === last) return;
      last = key;
      void moveNativeFeedAd(id, rect, visible);
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(sync);
    };

    // Defer requests until the slot approaches the screen. Never load an ad
    // for every offscreen post at once (AdMob has a finite request budget).
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      observer.disconnect();
      void (async () => {
        const rect = rectOf();
        if (!rect) return;
        const id = await showNativeFeedAd(rect);
        if (!alive) {
          if (id) void hideNativeFeedAd(id);
          return;
        }
        if (!id) {
          setFailed(true);
          return;
        }
        idRef.current = id;
        schedule();
      })();
    }, { rootMargin: "400px 0px" });
    if (ref.current) observer.observe(ref.current);

    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);

    return () => {
      alive = false;
      observer.disconnect();
      window.removeEventListener("scroll", schedule, { capture: true } as any);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
      if (idRef.current) void hideNativeFeedAd(idRef.current);
      idRef.current = null;
    };
  }, []);

  if (!nativeAdBridge()) return null;

  if (failed) return null;
  return <div ref={ref} style={{ height: AD_HEIGHT }} aria-label="Advertisement" />;
}
