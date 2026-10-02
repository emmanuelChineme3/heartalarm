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

// IMPORTANT: cache the *module*, never the plugin object itself. Capacitor plugin
// objects are Proxies that answer every property — including `then` — with a
// native method call. Resolving a Promise with one makes JS call `Contacts.then()`
// on the native side, which never settles, so the permission dialog never opened
// and the button spun forever on Android.
let contactsModulePromise: Promise<typeof import("@capacitor-community/contacts")> | null = null;
// Returned inside a box: an async function that returns the Proxy directly would
// make the Promise call `Contacts.then()` natively and hang forever.
async function nativeContactsBox(): Promise<{ plugin: any }> {
  const cap = (window as any).Capacitor;
  if (cap?.isPluginAvailable && !cap.isPluginAvailable("Contacts")) {
    console.error("[contacts] native Contacts plugin is not available in this APK");
    throw new Error("PLUGIN_MISSING");
  }
  contactsModulePromise ??= import("@capacitor-community/contacts").catch((e) => {
    contactsModulePromise = null;
    throw e;
  });
  const mod = await contactsModulePromise;
  console.log("[contacts] plugin module loaded");
  return { plugin: mod.Contacts };
}

/** Rejects if a native call never answers, so the UI can't hang forever. */
function withTimeout<T>(p: Promise<T>, ms: number, code: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(code)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Warms up the native plugin so the first tap doesn't pay the import cost. */
export function preloadContactsPlugin() {
  if (!isNativeApp()) return;
  void nativeContactsBox().catch(() => undefined);
}

/** Cache of the last device read (memory + on-device storage) so re-opening is instant. */
const CACHE_KEY = "ha_contacts_cache_v1";
let contactsCache: DeviceContact[] | null = null;
export function getCachedContacts(): DeviceContact[] | null {
  if (contactsCache) return contactsCache;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(CACHE_KEY) : null;
    if (raw) contactsCache = JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return contactsCache;
}
function storeCache(list: DeviceContact[]) {
  contactsCache = list;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export let lastContactsError: string | null = null;
let inflightRead: Promise<DeviceContact[]> | null = null;


/** Current native Contacts permission (web picker has no queryable state). */
export async function checkContactsPermission(): Promise<ContactsPermission> {
  if (!isNativeApp()) return contactsSupported() ? "prompt" : "unsupported";
  try {
    const Contacts = (await nativeContactsBox()).plugin;
    const res = await withTimeout(Contacts.checkPermissions(), 5000, "NATIVE_TIMEOUT");
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
    const Contacts = (await nativeContactsBox()).plugin;
    // Generous timeout: the user may take a while to answer the system dialog.
    const res = await withTimeout(Contacts.requestPermissions(), 60000, "NATIVE_TIMEOUT");
    if (res.contacts === "granted" || res.contacts === "limited") return "granted";
    return "denied";
  } catch (e) {
    console.error("[contacts] requestPermissions failed", e);
    lastContactsError = String((e as any)?.message ?? e);
    return "unsupported";
  }
}

async function readNativeContacts(): Promise<DeviceContact[]> {
  const Contacts = (await nativeContactsBox()).plugin;
  const { contacts } = await withTimeout(
    Contacts.getContacts({ projection: { name: true, phones: true } }),
    30000,
    "NATIVE_TIMEOUT",
  );
  const out: DeviceContact[] = [];
  const seen = new Set<string>();
  for (const c of contacts as any[]) {
    const tel = (c.phones ?? []).map((p: any) => p?.number).find((n: any) => !!n);
    if (!tel) continue;
    const key = normalizePhone(tel);
    if (key.length < 6 || seen.has(key)) continue;
    seen.add(key);
    const name =
      c.name?.display || [c.name?.given, c.name?.family].filter(Boolean).join(" ") || tel;
    out.push({ name, tel });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  storeCache(out);
  return out;
}

/**
 * Reads contacts from the device.
 * Native: one permission request (only if needed), then a single shared read.
 * Web: opens the OS contact picker so only picked entries are read.
 */
export async function pickDeviceContacts(
  opts: { permissionGranted?: boolean; force?: boolean } = {},
): Promise<DeviceContact[]> {
  if (isNativeApp()) {
    if (!opts.permissionGranted) {
      // requestPermissions returns immediately when already granted — no separate check.
      const state = await requestContactsPermission();
      if (state === "unsupported") throw new Error("NATIVE_FAILED");
      if (state !== "granted") throw new Error("PERMISSION_DENIED");
    }
    if (!opts.force && contactsCache) return contactsCache;
    inflightRead ??= readNativeContacts().finally(() => {
      inflightRead = null;
    });
    return inflightRead;
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
  storeCache(out);
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
