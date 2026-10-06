/** Server-only Adscod client. The publisher key never leaves the server. */
export const ADSCOD_PLACEMENTS = {
  feed: "0e2f7563-ddd6-4410-aea2-15e8d4e76859",
  stories: "d1ec5f59-b6a3-4c1b-b6e5-93447ff28ec5",
  push: "facf65ed-ba55-4c38-bd6f-ebffc7759745",
} as const;

export type AdscodSlot = keyof typeof ADSCOD_PLACEMENTS;

export type AdscodAd = {
  title: string;
  body: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  clickUrl: string;
  brandName: string | null;
  brandLogoUrl: string | null;
};

export async function fetchAdscodAd(slot: AdscodSlot): Promise<AdscodAd | null> {
  const key = process.env["ADSCOD_API_KEY"];
  if (!key) return null;
  const params = new URLSearchParams({
    source: "publisher",
    placementId: ADSCOD_PLACEMENTS[slot],
    device: "MOBILE",
    limit: "1",
  });
  try {
    const res = await fetch(`https://api.adscod.com/api/v1/serve?${params}`, {
      headers: { "X-Adscod-Key": key },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ads?: any[] } & Record<string, any>;
    const ad = Array.isArray(json.ads) ? json.ads[0] : json.clickUrl ? json : null;
    if (!ad || typeof ad.clickUrl !== "string" || !ad.title) return null;
    return {
      title: String(ad.title),
      body: ad.body ?? null,
      imageUrl: ad.imageUrl ?? null,
      ctaLabel: ad.ctaLabel ?? null,
      clickUrl: ad.clickUrl, // used exactly as returned
      brandName: ad.brandName ?? null,
      brandLogoUrl: ad.brandLogoUrl ?? null,
    };
  } catch {
    return null;
  }
}
