/** Minimal Firebase Cloud Messaging (HTTP v1) sender for Cloudflare Workers. */

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function b64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claim}`),
  );

  const jwt = `${header}.${claim}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const json = (await res.json()) as { access_token?: string };

  if (!json.access_token) throw new Error("FCM auth failed");

  return json.access_token;
}

export type FcmMessage = {
  title: string;
  body: string;
  imageUrl?: string | null;
  link?: string | null;
  type?: string;
  adUrl?: string | null;
};

function getWebLink(link?: string | null): string {
  const path =
    link && link.startsWith("/") && !link.startsWith("//")
      ? link
      : "/";

  return `https://heartalarm.lovable.app${path}`;
}

async function isUnregisteredToken(res: Response): Promise<boolean> {
  if (res.status !== 404) return false;

  try {
    const result = await res.clone().json();
    return result?.error?.details?.some(
      (detail: any) => detail?.errorCode === "UNREGISTERED",
    ) ?? false;
  } catch {
    return false;
  }
}

export async function sendFcmMessage(
  tokens: string[],
  msg: FcmMessage,
): Promise<{ sent: number; invalid: string[] }> {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];

  if (!raw || tokens.length === 0) {
    return { sent: 0, invalid: [] };
  }

  const sa = JSON.parse(raw) as ServiceAccount;
  const accessToken = await getAccessToken(sa);
  const invalid: string[] = [];
  let sent = 0;

  const chunkSize = 100;

  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize);

    await Promise.all(
      chunk.map(async (token) => {
        try {
          const res = await fetch(
            `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: {
                  token,
                  notification: {
                    title: msg.title,
                    body: msg.body,
                    ...(msg.imageUrl ? { image: msg.imageUrl } : {}),
                  },
                  data: {
                    type: msg.type ?? "broadcast",
                    title: msg.title,
                    body: msg.body,
                    ...(msg.link ? { link: msg.link } : {}),
                    ...(msg.adUrl ? { adUrl: msg.adUrl } : {}),
                  },
                  android: {
                    priority: "HIGH",
                    notification: {
                      channel_id: "heart_alarm",
                      sound: "default",
                      ...(msg.imageUrl ? { image: msg.imageUrl } : {}),
                      click_action: "FLUTTER_NOTIFICATION_CLICK",
                    },
                  },
                  webpush: {
                    headers: {
                      Urgency: "high",
                    },
                    notification: {
                      title: msg.title,
                      body: msg.body,
                      icon: "/favicon.ico",
                      badge: "/favicon.ico",
                      ...(msg.imageUrl ? { image: msg.imageUrl } : {}),
                    },
                    fcm_options: {
                      link: getWebLink(msg.link),
                    },
                  },
                },
              }),
            },
          );

          if (await isUnregisteredToken(res)) {
            invalid.push(token);
          } else if (res.ok) {
            sent += 1;
          } else {
            const errorText = await res.text();
            console.error("FCM send failed:", res.status, errorText);
          }
        } catch (error) {
          console.error("FCM request error:", error);
        }
      }),
    );
  }

  return { sent, invalid };
}

export async function sendFcm(
  tokens: string[],
  title: string,
  body: string,
): Promise<string[]> {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];

  if (!raw || tokens.length === 0) return [];

  const sa = JSON.parse(raw) as ServiceAccount;
  const accessToken = await getAccessToken(sa);
  const invalid: string[] = [];

  await Promise.all(
    tokens.map(async (token) => {
      try {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title, body },
                data: {
                  type: "heart_alarm",
                  title,
                  body,
                },
                android: {
                  priority: "HIGH",
                  notification: {
                    channel_id: "heart_alarm",
                    sound: "default",
                  },
                },
                webpush: {
                  headers: {
                    Urgency: "high",
                  },
                  notification: {
                    title,
                    body,
                    icon: "/favicon.ico",
                    badge: "/favicon.ico",
                  },
                  fcm_options: {
                    link: getWebLink("/"),
                  },
                },
              },
            }),
          },
        );

        if (await isUnregisteredToken(res)) {
          invalid.push(token);
        } else if (!res.ok) {
          console.error("FCM send failed:", res.status, await res.text());
        }
      } catch (error) {
        console.error("FCM request error:", error);
      }
    }),
  );

  return invalid;
}
