import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Avatar } from "@/components/ifriend/SignedImage";
import { Loader2, Plus, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/support")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: u.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: SupportAdminPage,
});

type Row = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

function SupportAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [seeding, setSeeding] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, bio, avatar_url")
      .eq("is_support", true)
      .order("username");
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function seed(count: number) {
    setSeeding(true);
    const { data, error } = await (supabase as any).rpc("admin_seed_support_profiles", { _count: count });
    setSeeding(false);
    if (error) return toast.error(error.message);
    toast.success(`Created ${data} support profiles`);
    load();
  }

  const filtered = rows.filter(
    (r) =>
      !q ||
      r.username.toLowerCase().includes(q.toLowerCase()) ||
      (r.display_name ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Support accounts</h1>
          <p className="text-xs text-muted-foreground">
            Fake profiles you manage. Edit avatar, bio, display name.
          </p>
        </div>
        <Link to="/admin" className="text-sm text-muted-foreground underline">
          ← Admin
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <Input
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{rows.length} accounts</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => seed(10)}
            disabled={seeding}
          >
            <Plus className="mr-1 h-3 w-3" /> +10
          </Button>
          <Button
            size="sm"
            onClick={() => seed(70)}
            disabled={seeding}
            className="brand-gradient text-primary-foreground"
          >
            {seeding ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
            Seed 70
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((r) => (
            <SupportRow key={r.id} row={r} onSaved={(next) => setRows((rs) => rs.map((x) => (x.id === r.id ? next : x)))} />
          ))}
        </div>
      )}
    </div>
  );
}

function SupportRow({ row, onSaved }: { row: Row; onSaved: (r: Row) => void }) {
  const [displayName, setDisplayName] = useState(row.display_name ?? "");
  const [bio, setBio] = useState(row.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(row.avatar_url ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await (supabase as any).rpc("admin_update_support_profile", {
      _id: row.id,
      _display_name: displayName || null,
      _bio: bio || null,
      _avatar_url: avatarUrl || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved({ ...row, display_name: displayName, bio, avatar_url: avatarUrl });
  }

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const path = `support/${row.id}-${Date.now()}.${(f.name.split(".").pop() || "jpg").toLowerCase()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, f, {
      contentType: f.type,
      upsert: true,
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    setAvatarUrl(path);
    toast.success("Avatar uploaded — click Save");
  }

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <Avatar path={avatarUrl || null} name={displayName || row.username} size={48} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">@{row.username}</div>
          <label className="cursor-pointer text-[11px] text-primary underline">
            {uploading ? "Uploading…" : "Change avatar"}
            <input type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
          </label>
        </div>
      </div>
      <Input
        placeholder="Display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      <Textarea
        placeholder="Bio"
        value={bio}
        rows={2}
        maxLength={280}
        onChange={(e) => setBio(e.target.value)}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={saving} className="brand-gradient text-primary-foreground">
          {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
          Save
        </Button>
      </div>
    </div>
  );
}
