import { PushNotifications } from "@capacitor/push-notifications";

export async function registerPushNotifications() {
  const permission = await PushNotifications.requestPermissions();

  console.log("Permission:", permission);

  if (permission.receive !== "granted") {
    console.log("Permission denied");
    return;
  }

  await PushNotifications.register();

  PushNotifications.addListener("registration", (token) => {
    console.log("🔥 Push Token:", token.value);
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.error("Registration error:", err);
  });
}
