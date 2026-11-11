import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/ifriend/native";

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

declare const firebase: any;

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCNpwMu0Y80rWcnatAVTl6jKcTT-9EruRU",
  authDomain: "heart-alarm-c9092.firebaseapp.com",
  projectId: "heart-alarm-c9092",
  storageBucket: "heart-alarm-c9092.firebasestorage.app",
  messagingSenderId: "627121672762",
  appId: "1:627121672762:web:dc63a534c1cf2521f6db03",
  measurementId: "G-W8LQ2P2NJV",
};

const VAPID_KEY =
  "BGqLbJlV4HHQhj1PY3MQ9XQx2Z2pOm2CMt4qA7nm3n9f3HU90At_u-82ISpH_hbQhgzZ7kbxE04jsYuLj6TZ2a8";

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

async function saveToken(token: string, platform: "android" | "web") {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;

  if (!uid) {
    setState({
      status: "error",
      detail: "Not signed in when token arrived",
      token,
    });
    return;
  }

  const { error } = await (supabase as any)
    .from("device_tokens")
    .upsert(
      {
        user_id: uid,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );

  if (error) {
    setState({
      status: "error",
      detail: `Saving token failed: ${error.message}`,
      token,
    });
    return;
  }

  setState({ status: "registered", token });
}

function loadFirebaseScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${src}"]`,
    ) as HTMLScriptElement | null;

    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Firebase script failed to load")),
          { once: true },
        );
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;

    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };

    script.onerror = () => {
      reject(new Error("Firebase script failed to load"));
    };

    document.head.appendChild(script);
  });
}

async function registerWebPush(): Promise<PushState> {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    setState({
      status: "error",
      detail: "This browser does not support web push notifications.",
    });
    return state;
  }

  setState({ status: "requesting" });

  let permission = Notification.permission;

  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    setState({
      status: "denied",
      detail: "Notification permission was not granted.",
    });
    return state;
  }

  setState({ status: "registering" });

  await loadFirebaseScript(
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
  );

  await loadFirebaseScript(
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js",
  );

  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }

  const swUrl = new URL(
    "/firebase-messaging-sw.js",
    window.location.origin,
  );

  Object.entries(FIREBASE_CONFIG).forEach(([key, value]) => {
    swUrl.searchParams.set(key, value);
  });

  const registration = await navigator.serviceWorker.register(
    swUrl.toString(),
    { scope: "/" },
  );

  await navigator.serviceWorker.ready;

  const messaging = firebase.messaging();

  const token = await messaging.getToken({
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    setState({
      status: "error",
      detail: "Firebase did not return a web notification token.",
    });
    return state;
  }

  await saveToken(token, "web");
  return state;
}

export async function registerPushNotifications(
  onNotificationOpened?: () => void,
): Promise<PushState> {
  if (onNotificationOpened) {
    openedHandler = onNotificationOpened;
  }

  if (state.status === "registered") return state;
  if (inFlight) return inFlight;

  inFlight = (async (): Promise<PushState> => {
    try {
      if (!isNativeApp()) {
        return await registerWebPush();
      }

      const { PushNotifications } = await import(
        "@capacitor/push-notifications"
      );

      setState({ status: "requesting" });

      let perm = await PushNotifications.checkPermissions();

      if (perm.receive !== "granted") {
        perm = await PushNotifications.requestPermissions();
      }

      if (perm.receive !== "granted") {
        setState({
          status: "denied",
          detail: `Permission: ${perm.receive}`,
        });
        return state;
      }

      if (!listenersBound) {
        listenersBound = true;

        await PushNotifications.addListener("registration", (token) => {
          void saveToken(token.value, "android");
        });

        await PushNotifications.addListener(
          "registrationError",
          (err: any) => {
            setState({
              status: "error",
              detail: `FCM registration error: ${
                err?.error ?? JSON.stringify(err)
              }`,
            });
          },
        );

        await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action: any) => {
            const data = action?.notification?.data ?? {};

            if (
              data.type === "ad" &&
              typeof data.adUrl === "string" &&
              data.adUrl.startsWith("https://")
            ) {
              window.open(data.adUrl, "_blank");
              return;
            }

            const link =
              typeof data.link === "string" ? data.link : "";

            if (link.startsWith("/") && !link.startsWith("//")) {
              window.location.assign(link);
              return;
            }

            openedHandler?.();
          },
        );
      }

      try {
        await PushNotifications.createChannel({
          id: "heart_alarm",
          name: "Rings & messages",
          description: "Heart Alarm rings and new messages",
          importance: 5,
          visibility: 1,
          sound: "default",
          vibration: true,
        } as any);
      } catch {
        // Channel creation is best-effort.
      }

      setState({ status: "registering" });
      await PushNotifications.register();

      return state;
    } catch (e: any) {
      setState({
        status: "error",
        detail: e?.message ?? String(e),
      });
      return state;
    }
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
