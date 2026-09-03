/** Google AdMob identifiers + runtime helpers for Heart Alarm (Android app). */
export const ADMOB_APP_ID = "ca-app-pub-6835603710386128~2032286443";
/** Native advanced ad unit — rendered as a card inside the feed. */
export const ADMOB_NATIVE_FEED_UNIT_ID =
  "ca-app-pub-6835603710386128/9623836001";

/** True only inside the Capacitor Android/iOS shell. */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

let initialized = false;
let starting: Promise<void> | null = null;
let lastError: string | null = null;

/** Diagnostics for the settings screen. */
export function adMobStatus() {
  return {
    native: isNativeApp(),
    initialized,
    format: "native-feed",
    unitId: ADMOB_NATIVE_FEED_UNIT_ID,
    lastError,
  };
}

/**
 * Initializes the AdMob SDK. No banners are shown — Heart Alarm uses native
 * feed ads rendered as cards inside the feed (see NativeFeedAd).
 * No-ops on web.
 */
export async function startAdMob(): Promise<void> {
  if (!isNativeApp()) return;
  if (initialized) return;
  if (starting) return starting;

  starting = (async () => {
    try {
      const { AdMob } = await import("@capacitor-community/admob");
      await AdMob.initialize({ initializeForTesting: false });
      try {
        const info = await AdMob.trackingAuthorizationStatus();
        if (info.status === "notDetermined") {
          await AdMob.requestTrackingAuthorization();
        }
      } catch {
        /* Android has no ATT prompt */
      }
      // Make sure no legacy anchored banner remains on screen.
      try {
        await AdMob.hideBanner();
        await AdMob.removeBanner();
      } catch {
        /* nothing to hide */
      }
      initialized = true;
      lastError = null;
    } catch (err: any) {
      lastError = String(err?.message ?? err);
      console.warn("AdMob init failed", err);
      initialized = false;
    } finally {
      starting = null;
    }
  })();

  return starting;
}

export type NativeAdCreative = {
  headline?: string;
  body?: string;
  advertiser?: string;
  callToAction?: string;
  iconUrl?: string;
  imageUrl?: string;
};

/**
 * Loads one native-ad creative for the feed.
 * Uses whichever native-ad API the installed AdMob plugin exposes; returns
 * null when the running build has no native-ad support (e.g. web preview).
 */
export async function loadNativeFeedAd(): Promise<NativeAdCreative | null> {
  if (!isNativeApp()) return null;
  await startAdMob();
  if (!initialized) return null;
  try {
    const mod: any = await import("@capacitor-community/admob");
    const AdMob: any = mod.AdMob;
    const load =
      AdMob?.loadNativeAd ?? AdMob?.showNativeAd ?? AdMob?.prepareNativeAd;
    if (typeof load !== "function") {
      lastError = "native ads not supported by installed AdMob plugin";
      return null;
    }
    const res = await load.call(AdMob, {
      adId: ADMOB_NATIVE_FEED_UNIT_ID,
      isTesting: false,
    });
    const ad = res?.ad ?? res;
    if (!ad || (!ad.headline && !ad.body)) return null;
    lastError = null;
    return {
      headline: ad.headline,
      body: ad.body,
      advertiser: ad.advertiser ?? ad.store,
      callToAction: ad.callToAction ?? ad.cta,
      iconUrl: ad.icon ?? ad.iconUrl,
      imageUrl: ad.cover ?? ad.imageUrl ?? ad.image,
    };
  } catch (err: any) {
    lastError = String(err?.message ?? err);
    return null;
  }
}

/** Kept for compatibility — Heart Alarm no longer shows anchored banners. */
export async function hideAdMobBanner(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { AdMob } = await import("@capacitor-community/admob");
    await AdMob.hideBanner();
  } catch {
    /* ignore */
  }
}
