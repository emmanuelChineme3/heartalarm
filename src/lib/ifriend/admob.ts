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

export type AdRect = { x: number; y: number; width: number; height: number };

type NativeAdBridge = {
  show(o: { adId: string } & AdRect): Promise<{ id: string; headline?: string }>;
  move(o: { id: string; visible: boolean } & AdRect): Promise<void>;
  hide(o: { id: string }): Promise<void>;
};

/** The native overlay plugin, or null on web / older builds. */
export function nativeAdBridge(): NativeAdBridge | null {
  if (!isNativeApp()) return null;
  const plugin = (window as any).Capacitor?.Plugins?.NativeAd;
  return plugin ?? null;
}

/**
 * Shows a real Google NativeAdView on top of the WebView at `rect`.
 * The Google view renders the creative and owns impression/click reporting —
 * the web layer only reserves the space. Returns the overlay id, or null when
 * unavailable (web preview) or when the ad did not fill.
 */
export async function showNativeFeedAd(rect: AdRect): Promise<string | null> {
  const bridge = nativeAdBridge();
  if (!bridge) return null;
  await startAdMob();
  try {
    const res = await bridge.show({ adId: ADMOB_NATIVE_FEED_UNIT_ID, ...rect });
    lastError = null;
    return res?.id ?? null;
  } catch (err: any) {
    lastError = String(err?.message ?? err);
    return null;
  }
}

export async function moveNativeFeedAd(
  id: string,
  rect: AdRect,
  visible: boolean,
): Promise<void> {
  const bridge = nativeAdBridge();
  if (!bridge) return;
  try {
    await bridge.move({ id, visible, ...rect });
  } catch {
    /* ignore */
  }
}

export async function hideNativeFeedAd(id: string): Promise<void> {
  const bridge = nativeAdBridge();
  if (!bridge) return;
  try {
    await bridge.hide({ id });
  } catch {
    /* ignore */
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
