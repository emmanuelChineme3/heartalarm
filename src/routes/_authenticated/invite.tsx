import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Share2, MessageCircle, Facebook, Mail, Copy, Phone, BookUser } from "lucide-react";

export const Route = createFileRoute("/_authenticated/invite")({
  component: InvitePage,
});

type Contact = { name?: string[]; tel?: string[] };

function InvitePage() {
  const { user } = Route.useRouteContext();
  const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : "https://ifriendsocial.lovable.app"}/auth?ref=${user.id}`;
  const defaultMsg = `Hey! Join me on iFriend — share moments, chat, and vibe with friends. ${inviteUrl}`;
  const [message, setMessage] = useState(defaultMsg);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [picking, setPicking] = useState(false);

  const enc = (s: string) => encodeURIComponent(s);

  async function nativeShare() {
    if (!navigator.share) {
      await navigator.clipboard.writeText(message);
      toast.success("Link copied");
      return;
    }
    try {
      await navigator.share({ title: "Join me on iFriend", text: message, url: inviteUrl });
    } catch {
      /* user cancelled */
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Link copied");
  }

  async function pickContacts() {
    const nav = navigator as any;
    if (!nav.contacts?.select) {
      toast.error("Contact picker not supported on this device. Use WhatsApp or SMS instead.");
      return;
    }
    setPicking(true);
    try {
      const picked: Contact[] = await nav.contacts.select(["name", "tel"], { multiple: true });
      setContacts(picked);
      if (picked.length === 0) toast("No contacts selected");
      else toast.success(`${picked.length} contact${picked.length === 1 ? "" : "s"} loaded`);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't open contacts");
    } finally {
      setPicking(false);
    }
  }

  function smsTo(tel?: string) {
    const base = tel ? `sms:${tel}` : "sms:";
    window.location.href = `${base}?&body=${enc(message)}`;
  }

  function whatsappTo(tel?: string) {
    const clean = tel?.replace(/[^\d+]/g, "").replace(/^\+/, "");
    const url = clean
      ? `https://wa.me/${clean}?text=${enc(message)}`
      : `https://wa.me/?text=${enc(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function facebookShare() {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${enc(inviteUrl)}&quote=${enc(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function messengerShare() {
    const url = `fb-messenger://share?link=${enc(inviteUrl)}`;
    window.location.href = url;
  }

  function emailShare() {
    window.location.href = `mailto:?subject=${enc("Join me on iFriend")}&body=${enc(message)}`;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Invite friends</h1>
        <p className="text-sm text-muted-foreground">Bring your people to iFriend — earn good vibes ✨</p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-4 space-y-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Your invite link</label>
          <div className="mt-1 flex gap-2">
            <Input readOnly value={inviteUrl} className="text-xs" />
            <Button onClick={copy} variant="outline" size="icon"><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Message</label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="mt-1 text-sm" />
        </div>
        <Button onClick={nativeShare} className="w-full brand-gradient text-primary-foreground">
          <Share2 className="mr-2 h-4 w-4" /> Share via…
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ShareTile onClick={() => whatsappTo()} icon={<MessageCircle className="h-5 w-5" />} label="WhatsApp" tint="bg-emerald-500/15 text-emerald-400" />
        <ShareTile onClick={facebookShare} icon={<Facebook className="h-5 w-5" />} label="Facebook" tint="bg-blue-500/15 text-blue-400" />
        <ShareTile onClick={messengerShare} icon={<MessageCircle className="h-5 w-5" />} label="Messenger" tint="bg-sky-500/15 text-sky-400" />
        <ShareTile onClick={() => smsTo()} icon={<Phone className="h-5 w-5" />} label="SMS" tint="bg-purple-500/15 text-purple-300" />
        <ShareTile onClick={emailShare} icon={<Mail className="h-5 w-5" />} label="Email" tint="bg-rose-500/15 text-rose-300" />
        <ShareTile onClick={copy} icon={<Copy className="h-5 w-5" />} label="Copy link" tint="bg-muted text-foreground" />
      </div>

      <div className="rounded-3xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2"><BookUser className="h-4 w-4 text-primary" /> Phone contacts</h2>
            <p className="text-xs text-muted-foreground">Pick contacts from your phone (Android Chrome).</p>
          </div>
          <Button onClick={pickContacts} disabled={picking} size="sm" variant="outline">
            {picking ? "Opening…" : "Pick"}
          </Button>
        </div>
        {contacts.length > 0 && (
          <ul className="divide-y divide-border">
            {contacts.map((c, i) => {
              const name = c.name?.[0] || "Unknown";
              const tel = c.tel?.[0];
              return (
                <li key={i} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{name}</div>
                    <div className="text-xs text-muted-foreground truncate">{tel ?? "no number"}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => whatsappTo(tel)}>WhatsApp</Button>
                    <Button size="sm" variant="outline" onClick={() => smsTo(tel)}>SMS</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ShareTile({ onClick, icon, label, tint }: { onClick: () => void; icon: React.ReactNode; label: string; tint: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition hover:border-primary"
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${tint}`}>{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
