/**
 * Registers the native device for Firebase push notifications and stores the
 * token so the backend can ring this user while the app is closed.
 */
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/ifriend/admob";

let started = false;

export async function registerPushNotifications(
  onNotificationOpened?: () => void,
): Promise<void> {
  if (started || !isNativeApp()) return;
  started = true;
  try {
    const { PushNotifications } = await import(
      "@capacitor/push-notifications"
    );

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return;

    await PushNotifications.addListener("registration", async (token) => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      await (supabase as any)
        .from("device_tokens")
        .upsert(
          { user_id: uid, token: token.value, platform: "android", updated_at: new Date().toISOString() },
          { onConflict: "token" },
        );
    });

    await PushNotifications.addListener("registrationError", () => {
      /* noop */
    });

    await PushNotifications.addListener("pushNotificationActionPerformed", () => {
      onNotificationOpened?.();
    });

    await PushNotifications.register();
  } catch {
    /* noop */
  }
}
