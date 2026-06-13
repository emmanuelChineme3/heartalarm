import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/groups/new")({
  component: CreateGroup,
});

function CreateGroup() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function create() {
    if (!name.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    setBusy(true);
    try {
      const { data: convId, error } = await supabase.rpc("create_conversation", {
        _is_group: true,
        _name: name.trim(),
        _member_ids: [],
      });
      if (error || !convId) throw error ?? new Error("Failed");

      let avatar_url: string | null = null;
      if (file) {
        const path = `groups/${convId}-${Date.now()}.${file.name.split(".").pop() ?? "jpg"}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
        if (!upErr) avatar_url = path;
      }

      if (description.trim() || avatar_url) {
        await supabase.rpc("update_conversation_details", {
          _conv: convId as string,
          _name: null,
          _description: description.trim() || null,
          _avatar_url: avatar_url,
        });
      }

      toast.success("Group created");
      navigate({ to: "/chat/$id", params: { id: convId as string } });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't create group");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/groups" className="rounded-full p-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Create Group</h1>
      </div>

      <div className="flex flex-col items-center gap-3">
        <label className="relative cursor-pointer">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted">
            {preview ? (
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <Users className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <span className="absolute bottom-0 right-0 rounded-full brand-gradient p-1.5 text-primary-foreground">
            <Camera className="h-3.5 w-3.5" />
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={pick} />
        </label>
        <p className="text-xs text-muted-foreground">Group picture (optional)</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground">Group name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend Crew" maxLength={60} />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground">Description (optional)</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this group about?"
          maxLength={240}
          rows={3}
        />
      </div>

      <Button onClick={create} disabled={busy} className="w-full brand-gradient text-primary-foreground">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Group"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        You'll get a join code and shareable invite link right after.
      </p>
      <input type="hidden" data-user-id={user.id} />
    </div>
  );
}
