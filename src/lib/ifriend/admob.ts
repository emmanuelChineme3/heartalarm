/** Google AdMob identifiers + runtime helpers for Heart Alarm (Android app). */
export const ADMOB_APP_ID = "ca-app-pub-6835603710386128~2032286443";
export const ADMOB_NATIVE_FEED_UNIT_ID =
  "ca-app-pub-6835603710386128/9623836001";

/** True only inside the Capacitor Android/iOS shell. */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

let initialized = false;

/**
 * Initializes AdMob and shows the anchored feed banner.
 * No-ops on web (Adsterra handles browser ads there).
 */
export async function startAdMob(): Promise<void> {
  if (initialized || !isNativeApp()) return;
  initialized = true;
  try {
    const { AdMob, BannerAdPosition, BannerAdSize } = await import(
      "@capacitor-community/admob"
    );
    await AdMob.initialize({ initializeForTesting: false });
    try {
      const info = await AdMob.trackingAuthorizationStatus();
      if (info.status === "notDetermined") {
        await AdMob.requestTrackingAuthorization();
      }
    } catch {
      /* Android has no ATT prompt */
    }
    await AdMob.showBanner({
      adId: ADMOB_NATIVE_FEED_UNIT_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 56, // sits above the bottom nav bar
    });
  } catch (err) {
    console.warn("AdMob init failed", err);
    initialized = false;
  }
}

export async function hideAdMobBanner(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { AdMob } = await import("@capacitor-community/admob");
    await AdMob.hideBanner();
  } catch {
    /* ignore */
  }
}
