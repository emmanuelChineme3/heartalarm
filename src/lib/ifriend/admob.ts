import { registerPlugin } from "@capacitor/core";

/** Native advanced ad unit for the Android Heart Alarm feed. */
export const ADMOB_APP_ID = "ca-app-pub-5628375196013002~2670128383";
/** Native advanced ad unit — rendered as a card inside the feed. */
export const ADMOB_NATIVE_FEED_UNIT_ID =
  "ca-app-pub-5628375196013002/7319372725";

/** True only inside the Capacitor Android/iOS shell. */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

let lastError: string | null = null;

export type AdRect = { x: number; y: number; width: number; height: number };

type NativeAdBridge = {
  show(o: { adId: string } & AdRect): Promise<{ id: string; headline?: string }>;
  move(o: { id: string; visible: boolean } & AdRect): Promise<void>;
  hide(o: { id: string }): Promise<void>;
};

// Capacitor's native plugin headers don't populate Capacitor.Plugins until
// registerPlugin is called. Registering here connects the web code to the APK.
const nativeAd = registerPlugin<NativeAdBridge>("NativeAd");

/** The native overlay plugin, or null on web / older builds. */
export function nativeAdBridge(): NativeAdBridge | null {
  if (!isNativeApp()) return null;
  const cap = (window as any).Capacitor;
  return cap?.isPluginAvailable?.("NativeAd") ? nativeAd : null;
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
  try {
    const res = await bridge.show({ adId: ADMOB_NATIVE_FEED_UNIT_ID, ...rect });
    lastError = null;
    return res?.id ?? null;
  } catch (err: any) {
    lastError = String(err?.message ?? err);
    console.warn("Native feed ad unavailable:", lastError);
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

