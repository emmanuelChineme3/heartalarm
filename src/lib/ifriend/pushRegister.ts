/**
 * Registers the native device for Firebase push notifications and stores the
 * token so the backend can ring this user while the app is closed.
 *
 * Diagnostics matter here: every step reports a status so the Settings screen
 * can show the user exactly where registration stopped.
 */
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/ifriend/admob";

export type PushStatus =
  | "idle"
  | "not-native"
  | "requesting"
  | "denied"
  | "registering"
  | "registered"
  | "error";

export type PushState = {
  status: PushStatus;
  detail?: string;
  token?: string;
};

let state: PushState = { status: "idle" };
let inFlight: Promise<PushState> | null = null;
let listenersBound = false;
let openedHandler: (() => void) | undefined;

const subscribers = new Set<(s: PushState) => void>();

function setState(next: PushState) {
  state = next;
  subscribers.forEach((fn) => fn(state));
}

export function getPushState(): PushState {
  return state;
}

export function subscribePushState(fn: (s: PushState) => void) {
  subscribers.add(fn);
  fn(state);
  return () => subscribers.delete(fn);
}

async function saveToken(token: string) {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) {
    setState({ status: "error", detail: "Not signed in when token arrived", token });
    return;
  }
  const { error } = await (supabase as any).from("device_tokens").upsert(
    {
      user_id: uid,
      token,
      platform: "android",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
  if (error) {
    setState({ status: "error", detail: `Saving token failed: ${error.message}`, token });
    return;
  }
  setState({ status: "registered", token });
}

/**
 * Requests the Android POST_NOTIFICATIONS permission and registers with FCM.
 * Safe to call repeatedly — a failed attempt never permanently locks itself out.
 */
export async function registerPushNotifications(
  onNotificationOpened?: () => void,
): Promise<PushState> {
  if (onNotificationOpened) openedHandler = onNotificationOpened;
  if (state.status === "registered") return state;
  if (inFlight) return inFlight;

  inFlight = (async (): Promise<PushState> => {
    if (!isNativeApp()) {
      setState({ status: "not-native" });
      return state;
    }
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");

      setState({ status: "requesting" });
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive !== "granted") {
        // This is what raises the Android 13+ POST_NOTIFICATIONS system dialog.
        perm = await PushNotifications.requestPermissions();
      }
      if (perm.receive !== "granted") {
        setState({ status: "denied", detail: `Permission: ${perm.receive}` });
        return state;
      }

      if (!listenersBound) {
        listenersBound = true;
        await PushNotifications.addListener("registration", (token) => {
          void saveToken(token.value);
        });
        await PushNotifications.addListener("registrationError", (err: any) => {
          setState({
            status: "error",
            detail: `FCM registration error: ${err?.error ?? JSON.stringify(err)}`,
          });
        });
        await PushNotifications.addListener("pushNotificationActionPerformed", (action: any) => {
          const data = action?.notification?.data ?? {};
          const link = typeof data.link === "string" ? data.link : "";
          // Only in-app paths are followed, never arbitrary external URLs.
          if (link.startsWith("/") && !link.startsWith("//")) {
            window.location.assign(link);
            return;
          }
          openedHandler?.();
        });
      }

      setState({ status: "registering" });
      await PushNotifications.register();
      return state;
    } catch (e: any) {
      setState({ status: "error", detail: e?.message ?? String(e) });
      return state;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
