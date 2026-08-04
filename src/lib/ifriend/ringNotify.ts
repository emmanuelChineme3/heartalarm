/**
 * Heart Alarm notifications for when the recipient is OUTSIDE the app
 * (backgrounded tab / native app not in foreground).
 * Native: Capacitor local notification. Web: Notification API.
 * The full ringing experience is played when the app is opened again.
 */
import { isNativeApp } from "@/lib/ifriend/admob";

const TITLE = "💗 Heart Alarm";
const BODY = "Someone has a heart for your vibe — open to reveal.";

export function appIsForeground() {
  if (typeof document === "undefined") return false;
  return document.visibilityState === "visible" && document.hasFocus();
}

export async function requestRingNotificationPermission() {
  try {
    if (isNativeApp()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.requestPermissions();
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch {
    /* noop */
  }
}

export async function notifyIncomingRing() {
  try {
    if (isNativeApp()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") return;
      }
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 100000),
            title: TITLE,
            body: BODY,
            smallIcon: "ic_launcher",
          },
        ],
      });
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const n = new Notification(TITLE, { body: BODY });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    }
  } catch {
    /* noop */
  }
}
