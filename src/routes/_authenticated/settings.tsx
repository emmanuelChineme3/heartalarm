import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/ifriend/SignedImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Camera } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, display_name, bio, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setUsername(data.username ?? "");
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setAvatarPath(data.avatar_url ?? null);
      }
      setLoading(false);
    })();
  }, [user.id]);

  async function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, f, { contentType: f.type, upsert: false });
    if (error) return toast.error("Couldn't upload");
    const { error: upErr } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
    if (upErr) return toast.error("Couldn't save avatar");
    setAvatarPath(path);
    toast.success("Avatar updated");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (cleanUsername.length < 2) {
      setSaving(false);
      return toast.error("Username must be at least 2 characters");
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        username: cleanUsername,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    router.navigate({ to: "/p/$username", params: { username: cleanUsername } });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <h1 className="text-xl font-bold">Edit profile</h1>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative"
          aria-label="Change avatar"
        >
          <Avatar path={avatarPath} name={displayName || username} size={86} />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100">
            <Camera className="h-5 w-5 text-white" />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
        <div className="text-xs text-muted-foreground">Tap photo to change</div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={2}
          maxLength={20}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="display">Display name</Label>
        <Input id="display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} rows={3} />
      </div>

      <Button type="submit" disabled={saving} className="w-full brand-gradient text-primary-foreground">
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save
      </Button>

      <NotificationDiagnostics />
    </form>
  );
}

function NotificationDiagnostics() {
  const [state, setState] = useState<PushState>(getPushState());
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribePushState(setState) as unknown as () => void, []);

  const label: Record<PushState["status"], string> = {
    idle: "Not started",
    "not-native": "Web browser — push notifications need the Android app",
    requesting: "Asking for notification permission…",
    denied: "Permission denied — enable notifications in Android settings",
    registering: "Registering with Firebase…",
    registered: "Active — this device can receive Heart Alarm rings",
    error: "Something went wrong",
  };

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-1 text-sm font-semibold">Ring notifications</div>
      <p className="text-xs text-muted-foreground">{label[state.status]}</p>
      {state.detail && (
        <p className="mt-1 break-all text-[11px] text-muted-foreground">{state.detail}</p>
      )}
      {state.token && (
        <p className="mt-1 break-all text-[11px] text-muted-foreground">
          Device token: {state.token.slice(0, 12)}…
        </p>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-3"
        disabled={busy || state.status === "registered"}
        onClick={async () => {
          setBusy(true);
          const s = await registerPushNotifications();
          setBusy(false);
          if (s.status === "denied") {
            toast.error("Enable notifications for Heart Alarm in Android settings.");
          } else if (s.status === "error") {
            toast.error(s.detail ?? "Notification setup failed");
          }
        }}
      >
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {state.status === "registered" ? "Enabled" : "Enable ring notifications"}
      </Button>
    </div>
  );
}

