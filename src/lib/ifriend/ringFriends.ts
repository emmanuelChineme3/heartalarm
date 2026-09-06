import { supabase } from "@/integrations/supabase/client";
import { localDate, type RingResult } from "@/lib/ifriend/rings";

export type DeviceContact = { name: string; tel: string };

export type ContactRow = DeviceContact & {
  userId: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

/** Last 9 digits — same normalization the database uses for matching. */
export function normalizePhone(p: string): string {
  return p.replace(/[^0-9]/g, "").slice(-9);
}

import { isNativeApp } from "@/lib/ifriend/admob";

export type ContactsPermission = "granted" | "denied" | "prompt" | "unsupported";

export function contactsSupported(): boolean {
  if (isNativeApp()) return true;
  return typeof navigator !== "undefined" && !!(navigator as any).contacts?.select;
}

let contactsPluginPromise: Promise<any> | null = null;
async function nativeContacts() {
  // Cached so the (fairly heavy) plugin module is only imported once.
  contactsPluginPromise ??= import("@capacitor-community/contacts").then((m) => m.Contacts);
  return contactsPluginPromise;
}

/** Warms up the native plugin so the first tap doesn't pay the import cost. */
export function preloadContactsPlugin() {
  if (!isNativeApp()) return;
  void nativeContacts().catch(() => undefined);
}

/** In-memory cache of the last device read, so re-opening the screen is instant. */
let contactsCache: DeviceContact[] | null = null;
export function getCachedContacts(): DeviceContact[] | null {
  return contactsCache;
}


/** Current native Contacts permission (web picker has no queryable state). */
export async function checkContactsPermission(): Promise<ContactsPermission> {
  if (!isNativeApp()) return contactsSupported() ? "prompt" : "unsupported";
  try {
    const Contacts = await nativeContacts();
    const res = await Contacts.checkPermissions();
    if (res.contacts === "granted" || res.contacts === "limited") return "granted";
    if (res.contacts === "denied") return "denied";
    return "prompt";
  } catch {
    return "unsupported";
  }
}

/** Shows the native Android Contacts permission dialog. */
export async function requestContactsPermission(): Promise<ContactsPermission> {
  if (!isNativeApp()) return contactsSupported() ? "prompt" : "unsupported";
  try {
    const Contacts = await nativeContacts();
    const res = await Contacts.requestPermissions();
    if (res.contacts === "granted" || res.contacts === "limited") return "granted";
    return "denied";
  } catch {
    return "unsupported";
  }
}

/**
 * Reads contacts from the device.
 * Native: requests the Contacts permission first and reads names + numbers locally.
 * Web: opens the OS contact picker so only picked entries are read.
 * Nothing is uploaded except the normalized digits used for matching.
 */
export async function pickDeviceContacts(): Promise<DeviceContact[]> {
  if (isNativeApp()) {
    let state = await checkContactsPermission();
    if (state !== "granted") state = await requestContactsPermission();
    if (state !== "granted") throw new Error("PERMISSION_DENIED");
    // Instant path: reuse the last device read while permission is still granted.
    if (contactsCache) return contactsCache;
    const Contacts = await nativeContacts();
    const { contacts } = await Contacts.getContacts({
      projection: { name: true, phones: true },
    });
    const out: DeviceContact[] = [];
    const seen = new Set<string>();
    for (const c of contacts as any[]) {
      const tel = (c.phones ?? []).map((p: any) => p?.number).find((n: any) => !!n);
      if (!tel) continue;
      const key = normalizePhone(tel);
      if (key.length < 6 || seen.has(key)) continue;
      seen.add(key);
      const name =
        c.name?.display ||
        [c.name?.given, c.name?.family].filter(Boolean).join(" ") ||
        tel;
      out.push({ name, tel });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    contactsCache = out;
    return out;
  }


  const nav = navigator as any;
  if (!nav.contacts?.select) throw new Error("UNSUPPORTED");
  const picked: { name?: string[]; tel?: string[] }[] = await nav.contacts.select(
    ["name", "tel"],
    { multiple: true },
  );
  const out: DeviceContact[] = [];
  for (const c of picked) {
    const tel = (c.tel ?? []).find((t) => !!t);
    if (!tel) continue;
    out.push({ name: (c.name ?? []).find(Boolean) ?? tel, tel });
  }
  return out;
}

/**
 * Checks which picked contacts are already on Heart Alarm.
 * Only normalized digits of the *selected* contacts are sent — never the full address book,
 * and nothing is stored server-side.
 */
export async function matchContacts(contacts: DeviceContact[]): Promise<ContactRow[]> {
  const phones = contacts.map((c) => c.tel);
  const { data } = await (supabase as any).rpc("match_contacts", { _phones: phones });
  const map = new Map<string, any>();
  (data ?? []).forEach((r: any) => map.set(r.phone, r));
  return contacts.map((c) => {
    const hit = map.get(normalizePhone(c.tel));
    return {
      ...c,
      userId: hit?.user_id ?? null,
      username: hit?.username ?? null,
      displayName: hit?.display_name ?? hit?.username ?? null,
      avatarUrl: hit?.avatar_url ?? null,
    };
  });
}

/** Saves the current user's own number so their friends can find them from contacts. */
export async function saveMyPhone(userId: string, phone: string) {
  await supabase.from("profiles").update({ phone } as any).eq("id", userId);
}

/** Rings a Heart Alarm user directly (no post), reusing the 3-per-day quota. */
export async function ringUser(receiverId: string): Promise<RingResult> {
  const { error } = await (supabase as any).rpc("ring_user", {
    _receiver: receiverId,
    _local_date: localDate(),
  });
  if (error) {
    if (String(error.message ?? "").includes("DAILY_RING_LIMIT")) {
      return { ok: false, limitReached: true };
    }
    return { ok: false };
  }
  await (supabase as any).rpc("bump_ring_streak");
  void import("@/lib/ifriend/push.functions")
    .then(({ notifyRingUser }) => notifyRingUser({ data: { receiverId } }))
    .catch(() => undefined);
  return { ok: true };
}

/** Creates a shareable ring link for a contact who isn't on Heart Alarm yet. */
export async function createRingLink(contactName: string, message?: string): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc("create_ring_link", {
    _contact_name: contactName,
    _message: message ?? null,
  });
  if (error || !data) return null;
  return `${window.location.origin}/r/${data}`;
}

export const RING_LINK_STORAGE_KEY = "ha_pending_ring_token";
