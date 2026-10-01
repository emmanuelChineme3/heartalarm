import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Heart, Search, BookUser, MessageCircle, Loader2, Copy, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RingSentOverlay } from "@/components/ifriend/RingSentOverlay";
import { useRingsLeft, RING_LIMIT_MESSAGE } from "@/lib/ifriend/rings";
import {
  checkContactsPermission,
  contactsSupported,
  createRingLink,
  getCachedContacts,
  matchContacts,
  pickDeviceContacts,
  preloadContactsPlugin,
  ringUser,
  saveMyPhone,
  type ContactRow,
  type ContactsPermission,
  type DeviceContact,
} from "@/lib/ifriend/ringFriends";



export const Route = createFileRoute("/_authenticated/ring")({
  component: RingAFriend,
  head: () => ({
    meta: [
      { title: "Ring a Friend · Heart Alarm" },
      {
        name: "description",
        content:
          "Pick a friend from your contacts and send them a Heart Alarm — they feel it ring wherever they are.",
      },
      { property: "og:title", content: "Ring a Friend · Heart Alarm" },
      {
        property: "og:description",
        content: "Send someone a Heart Alarm ring straight from your contacts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Invite = { contact: ContactRow; link: string; text: string };

function RingAFriend() {
  const { user } = Route.useRouteContext();
  const { ringsLeft, refreshRings } = useRingsLeft();
  const [contacts, setContacts] = useState<ContactRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [q, setQ] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualTel, setManualTel] = useState("");
  const [myPhone, setMyPhone] = useState("");
  const [permission, setPermission] = useState<ContactsPermission>("prompt");
  const [invite, setInvite] = useState<Invite | null>(null);


  const load = useCallback(
    async (opts: { permissionGranted?: boolean; force?: boolean; silent?: boolean } = {}) => {
      if (!opts.silent) setLoading(true);
      try {
        const picked = await pickDeviceContacts(opts);
        setPermission("granted");
        if (picked.length === 0) {
          toast("No contacts found");
          setContacts([]);
          return;
        }
        // Show the list instantly, then fill in Heart Alarm status in the background.
        setContacts(
          picked.map((c) => ({
            ...c,
            userId: null,
            username: null,
            displayName: null,
            avatarUrl: null,
          })),
        );
        setLoading(false);
        setMatching(true);
        try {
          setContacts(await matchContacts(picked));
        } catch {
          /* keep the plain list if matching fails */
        } finally {
          setMatching(false);
        }
      } catch (e: any) {
        if (e?.message === "UNSUPPORTED") {
          setPermission("unsupported");
          toast.error("Your device can't share contacts here — add a friend's number below instead.");
        } else if (e?.message === "PERMISSION_DENIED") {
          setPermission("denied");
          toast.error("Contacts permission was blocked. Enable Contacts for Heart Alarm in your phone settings.");
        } else if (e?.message === "NATIVE_FAILED") {
          toast.error("Please update Heart Alarm to the latest version to use contacts.");
        } else {
          toast.error("Couldn't read your contacts");
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // On open: show cached contacts instantly, then refresh silently if permission is granted.
  useEffect(() => {
    preloadContactsPlugin();
    const cached = getCachedContacts();
    if (cached) setContacts(cached.map((c) => ({ ...c, userId: null, username: null, displayName: null, avatarUrl: null })));
    let cancelled = false;
    void (async () => {
      const state = await checkContactsPermission();
      if (cancelled) return;
      setPermission(state);
      if (state === "granted") {
        void load({ permissionGranted: true, force: true, silent: !!getCachedContacts() });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function allowContacts() {
    if (loading) return;
    if (!contactsSupported()) {
      setPermission("unsupported");
      toast.error(
        "This device can't share contacts with the browser — add a friend's number below instead.",
      );
      return;
    }
    // Single path: one permission request (native) or picker (web), then one read.
    await load({ permissionGranted: permission === "granted", force: !!contacts });
  }


  async function addManual() {
    if (!manualTel.trim()) return;
    const rows = await matchContacts([
      { name: manualName.trim() || manualTel.trim(), tel: manualTel.trim() },
    ]);
    setContacts((c) => [...(c ?? []), ...rows]);
    setManualName("");
    setManualTel("");
  }

  async function ring(c: ContactRow) {
    if (ringsLeft <= 0) {
      toast.error(RING_LIMIT_MESSAGE);
      return;
    }
    if (c.userId) {
      const res = await ringUser(c.userId);
      if (!res.ok) {
        toast.error(res.limitReached ? RING_LIMIT_MESSAGE : "Couldn't send that ring");
        return;
      }
      await refreshRings();
      setSentTo(c.displayName ?? c.name);
      return;
    }
    const link = await createRingLink(c.name);
    if (!link) {
      toast.error("Couldn't create the ring link");
      return;
    }
    const text = `💗 Someone sent you a Heart Alarm. Open it: ${link}`;
    setInvite({ contact: c, link, text });
  }

  function sendInvite(channel: "whatsapp" | "messenger" | "sms") {
    if (!invite) return;
    const { contact, link, text } = invite;
    const tel = contact.tel.replace(/[^\d+]/g, "").replace(/^\+/, "");
    if (channel === "whatsapp") {
      window.open(`https://wa.me/${tel}?text=${encodeURIComponent(text)}`, "_blank");
    } else if (channel === "messenger") {
      const native = `fb-messenger://share?link=${encodeURIComponent(link)}`;
      const web = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
      const w = window.open(native, "_blank");
      if (!w) window.open(web, "_blank");
    } else {
      window.location.href = `sms:${contact.tel}?&body=${encodeURIComponent(text)}`;
    }
    toast.success(`Heart Alarm link sent to ${contact.name}`);
    setInvite(null);
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return contacts ?? [];
    return (contacts ?? []).filter(
      (c) => c.name.toLowerCase().includes(s) || c.tel.includes(s),
    );
  }, [contacts, q]);

  return (
    <div className="space-y-6">
      <RingSentOverlay
        open={!!sentTo}
        onDone={() => setSentTo(null)}
      />

      {invite && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setInvite(null)}
        >
          <div
            className="w-full max-w-sm space-y-3 rounded-3xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <p className="text-base font-extrabold">Ring {invite.contact.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                They're not on Heart Alarm yet — send their Heart Alarm through:
              </p>
            </div>
            <Button
              onClick={() => sendInvite("whatsapp")}
              className="w-full rounded-full bg-[#25D366] py-5 text-sm font-bold text-white hover:opacity-90"
            >
              <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
            </Button>
            <Button
              onClick={() => sendInvite("messenger")}
              className="w-full rounded-full bg-[#0084FF] py-5 text-sm font-bold text-white hover:opacity-90"
            >
              <MessageCircle className="mr-2 h-4 w-4" /> Messenger
            </Button>
            <Button
              onClick={() => sendInvite("sms")}
              variant="secondary"
              className="w-full rounded-full py-5 text-sm font-bold"
            >
              <MessageCircle className="mr-2 h-4 w-4" /> SMS
            </Button>
          </div>
        </div>
      )}

      <header className="rounded-3xl border border-border bg-card p-6 text-center">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, #ff89a8 0%, #ff5c8a 45%, #e83f75 100%)",
            boxShadow: "0 12px 34px rgba(232,63,117,0.45)",
          }}
        >
          <Heart className="h-8 w-8 text-white" fill="currentColor" />
        </div>
        <h1 className="mt-3 text-2xl font-extrabold brand-text">Ring a Friend</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose someone from your contacts and let their Heart Alarm ring.
        </p>
        <p className="mt-2 text-xs font-semibold text-primary">
          {ringsLeft} of 3 rings left today
        </p>
      </header>

      <div className="rounded-3xl border border-border bg-card p-4">
        {permission === "denied" ? (
          <div className="space-y-2 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
            <p className="text-sm font-bold">Contacts permission needed</p>
            <p className="text-xs text-muted-foreground">
              Ring a Friend needs access to your contacts so it can show who is already on
              Heart Alarm. Your address book stays on your device. If you blocked it before,
              enable Contacts for Heart Alarm in your phone settings, then tap Try again.
            </p>
            <Button
              onClick={allowContacts}
              className="w-full rounded-full brand-gradient py-5 text-base font-bold text-primary-foreground hover:opacity-90"
            >
              <BookUser className="mr-2 h-5 w-5" /> Allow contacts
            </Button>
          </div>
        ) : (
          <>
            <Button
              onClick={allowContacts}
              disabled={loading}
              className="w-full rounded-full brand-gradient py-6 text-base font-bold text-primary-foreground hover:opacity-90"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BookUser className="mr-2 h-5 w-5" />
              )}
              {contacts ? "Refresh contacts" : "Allow contacts"}
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Only the numbers needed for matching are checked, and nothing from your address
              book is stored.
            </p>
          </>
        )}

        {(!contactsSupported() || permission === "denied" || permission === "unsupported") && (
          <div className="mt-4 space-y-2 rounded-2xl border border-border p-3">
            <p className="text-xs font-semibold">Add a friend manually</p>
            <div className="flex gap-2">
              <Input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Name"
              />
              <Input
                value={manualTel}
                onChange={(e) => setManualTel(e.target.value)}
                placeholder="Phone number"
                inputMode="tel"
              />
            </div>
            <Button size="sm" variant="secondary" className="rounded-full" onClick={addManual}>
              <UserPlus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
        )}
      </div>

      {contacts && contacts.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search contacts"
              className="rounded-full pl-9"
            />
          </div>
          {matching && (
            <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Checking who's on Heart Alarm…
            </p>
          )}

          <ul className="space-y-2">
            {filtered.map((c, i) => (
              <li
                key={`${c.tel}-${i}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-bold">
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    c.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.displayName ?? c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.userId ? (
                      <span className="text-primary">🟢 Joined Heart Alarm</span>
                    ) : (
                      <span>⚪ Not on Heart Alarm</span>
                    )}{" "}
                    · {c.tel}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => ring(c)}
                  className="shrink-0 rounded-full brand-gradient text-xs font-bold text-primary-foreground hover:opacity-90"
                >
                  {c.userId ? "💗 Ring" : <><MessageCircle className="mr-1 h-3.5 w-3.5" />💗 Ring</>}
                </Button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground">
                No contacts match “{q}”.
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card p-4">
        <p className="text-xs font-semibold">Let friends find you</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Save your number so contacts who have you saved can ring you directly.
        </p>
        <div className="mt-2 flex gap-2">
          <Input
            value={myPhone}
            onChange={(e) => setMyPhone(e.target.value)}
            placeholder="Your phone number"
            inputMode="tel"
          />
          <Button
            variant="secondary"
            className="rounded-full"
            onClick={async () => {
              if (!myPhone.trim()) return;
              await saveMyPhone(user.id, myPhone.trim());
              toast.success("Saved");
            }}
          >
            <Copy className="mr-1 h-4 w-4" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
}
