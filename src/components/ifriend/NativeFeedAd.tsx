import { useEffect, useState } from "react";
import { loadNativeFeedAd, type NativeAdCreative } from "@/lib/ifriend/admob";

/**
 * A Google AdMob native ad rendered as a feed card so it blends with posts.
 * Renders nothing when no ad is available (web preview, no fill).
 */
export function NativeFeedAd() {
  const [ad, setAd] = useState<NativeAdCreative | null>(null);

  useEffect(() => {
    let active = true;
    loadNativeFeedAd().then((a) => {
      if (active) setAd(a);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!ad) return null;

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card">
      <header className="flex items-center gap-3 px-4 py-3">
        {ad.iconUrl ? (
          <img
            src={ad.iconUrl}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {ad.headline ?? ad.advertiser ?? "Sponsored"}
          </div>
          <div className="text-xs text-muted-foreground">
            {ad.advertiser ?? "Sponsored"}
          </div>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
          Ad
        </span>
      </header>

      {ad.imageUrl && (
        <div className="aspect-square overflow-hidden bg-black">
          <img
            src={ad.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="px-4 py-3">
        {ad.body && <p className="text-sm leading-snug">{ad.body}</p>}
        {ad.callToAction && (
          <div className="mt-3 inline-flex rounded-full brand-gradient px-4 py-2 text-xs font-semibold text-primary-foreground">
            {ad.callToAction}
          </div>
        )}
      </div>
    </article>
  );
}
