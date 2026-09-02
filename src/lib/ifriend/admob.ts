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
let bannerVisible = false;
let starting: Promise<void> | null = null;
let lastError: string | null = null;

/** Diagnostics for the settings screen. */
export function adMobStatus() {
  return { native: isNativeApp(), initialized, bannerVisible, lastError };
}

async function showBannerOnce() {
  const { AdMob, BannerAdPosition, BannerAdSize } = await import(
    "@capacitor-community/admob"
  );
  await AdMob.showBanner({
    adId: ADMOB_NATIVE_FEED_UNIT_ID,
    adSize: BannerAdSize.ADAPTIVE_BANNER,
    position: BannerAdPosition.BOTTOM_CENTER,
    margin: 56, // sits above the bottom nav bar
    isTesting: false,
  });
}

/**
 * Initializes AdMob and shows the anchored banner.
 * Retries on failure (first launch often races the consent/SDK bootstrap) and
 * re-shows the banner whenever the app returns to the foreground.
 * No-ops on web.
 */
export async function startAdMob(): Promise<void> {
  if (!isNativeApp()) return;
  if (starting) return starting;

  starting = (async () => {
    try {
      const { AdMob } = await import("@capacitor-community/admob");

      if (!initialized) {
        await AdMob.initialize({ initializeForTesting: false });
        try {
          const info = await AdMob.trackingAuthorizationStatus();
          if (info.status === "notDetermined") {
            await AdMob.requestTrackingAuthorization();
          }
        } catch {
          /* Android has no ATT prompt */
        }

        // Surface load failures instead of silently showing nothing.
        try {
          AdMob.addListener("bannerAdFailedToLoad" as any, (e: any) => {
            bannerVisible = false;
            lastError = `banner failed: ${e?.message ?? e?.code ?? "unknown"}`;
            console.warn("AdMob banner failed to load", e);
          });
          AdMob.addListener("bannerAdLoaded" as any, () => {
            bannerVisible = true;
            lastError = null;
          });
        } catch {
          /* listeners are best-effort */
        }

        initialized = true;

        // Re-show the banner after the app comes back to the foreground.
        try {
          const { App } = await import("@capacitor/app");
          void App.addListener("appStateChange", ({ isActive }) => {
            if (isActive) void showBannerOnce().catch(() => undefined);
          });
        } catch {
          /* ignore */
        }
      }

      // Retry the banner a few times — no-fill right after cold start is common.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await showBannerOnce();
          lastError = null;
          return;
        } catch (err: any) {
          lastError = String(err?.message ?? err);
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
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

export async function hideAdMobBanner(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { AdMob } = await import("@capacitor-community/admob");
    await AdMob.hideBanner();
    bannerVisible = false;
  } catch {
    /* ignore */
  }
}
