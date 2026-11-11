importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js"
);

firebase.initializeApp(
  Object.fromEntries(new URL(self.location).searchParams)
);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // Firebase automatically displays notification payloads.
  // Only manually display data-only messages to prevent duplicates.
  if (payload?.notification) return;

  const title =
    payload?.data?.title || "Heart Alarm";

  const options = {
    body:
      payload?.data?.body || "You have a new notification.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: payload?.data || {},
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};

  const targetUrl =
    data.type === "ad" &&
    typeof data.adUrl === "string" &&
    data.adUrl.startsWith("https://")
      ? data.adUrl
      : typeof data.link === "string" &&
          data.link.startsWith("/") &&
          !data.link.startsWith("//")
        ? data.link
        : "/";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      return clients.openWindow(targetUrl);
    })
  );
});
