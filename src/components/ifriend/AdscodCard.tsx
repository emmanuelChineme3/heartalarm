import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdscodAd } from "@/lib/ifriend/adscod.functions";

export function useAdscodAd(slot: "feed" | "stories", key: string | number) {
  const fetchAd = useServerFn(getAdscodAd);
  return useQuery({
    queryKey: ["adscod", slot, key],
    queryFn: async () => (await fetchAd({ data: { slot } })).ad,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Native in-feed Adscod card. Opens ad.clickUrl exactly as returned. */
export function AdscodFeedCard({ index }: { index: number }) {
  const { data: ad } = useAdscodAd("feed", index);
  if (!ad) return null;
  return (
    <a
      href={ad.clickUrl}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="block overflow-hidden rounded-3xl border border-border bg-card"
    >
      <div className="flex items-center gap-2 p-3">
        {ad.brandLogoUrl && (
          <img src={ad.brandLogoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
        )}
        <span className="text-sm font-semibold">{ad.brandName ?? ad.title}</span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Sponsored
        </span>
      </div>
      {ad.imageUrl && <img src={ad.imageUrl} alt={ad.title} className="aspect-square w-full object-cover" loading="lazy" />}
      <div className="space-y-2 p-3">
        <p className="font-semibold">{ad.title}</p>
        {ad.body && <p className="text-sm text-muted-foreground">{ad.body}</p>}
        <span className="inline-block rounded-full brand-gradient px-4 py-1.5 text-xs font-bold text-primary-foreground">
          {ad.ctaLabel ?? "Learn more"}
        </span>
      </div>
    </a>
  );
}

/** Sponsored bubble for the Stories tray. */
export function AdscodStoryBubble() {
  const { data: ad } = useAdscodAd("stories", 0);
  if (!ad) return null;
  const img = ad.brandLogoUrl ?? ad.imageUrl;
  return (
    <a
      href={ad.clickUrl}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="flex w-16 shrink-0 flex-col items-center gap-1"
    >
      <div className="rounded-full border-2 border-muted p-[2px]">
        {img ? (
          <img src={img} alt={ad.title} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-xs font-bold">Ad</div>
        )}
      </div>
      <span className="w-16 truncate text-center text-[10px] text-muted-foreground">Sponsored</span>
    </a>
  );
}
