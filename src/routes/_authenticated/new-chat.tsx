import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/ifriend/SignedImage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Users, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/new-chat")({
  component: NewChat,
});

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

function NewChat() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile[]>([]);
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq("id", user.id)
        .limit(15);
      setResults((data ?? []) as Profile[]);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q, user.id]);

  function toggle(p: Profile) {
    setSelected((s) =>
      s.find((x) => x.id === p.id) ? s.filter((x) => x.id !== p.id) : [...s, p],
    );
  }

  async function start() {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const isGroup = selected.length > 1;

      // For DMs, reuse existing conversation if found
      if (!isGroup) {
        const other = selected[0];
        const { data: mine } = await supabase
          .from("conversation_members")
          .select("conversation_id, conversations!inner(is_group)")
          .eq("user_id", user.id);
        const myDmIds = (mine ?? [])
          .filter((m: any) => m.conversations && !m.conversations.is_group)
          .map((m: any) => m.conversation_id);
        if (myDmIds.length) {
          const { data: theirs } = await supabase
            .from("conversation_members")
            .select("conversation_id")
            .eq("user_id", other.id)
            .in("conversation_id", myDmIds);
          const existing = theirs?.[0]?.conversation_id;
          if (existing) {
            navigate({ to: "/chat/$id", params: { id: existing } });
            return;
          }
        }
      }

      const { data: convId, error: rpcErr } = await supabase.rpc("create_conversation", {
        _is_group: isGroup,
        _name: isGroup ? (groupName.trim() || "New group") : "",
        _member_ids: selected.map((s) => s.id),
      });
      if (rpcErr || !convId) throw rpcErr ?? new Error("Failed to create conversation");

      navigate({ to: "/chat/$id", params: { id: convId as string } });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't start chat");
    } finally {
      setBusy(false);
    }
  }

  const isGroup = selected.length > 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/inbox" className="rounded-full p-1.5 text-muted-foreground hover:text-foreground" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">New message</h1>
      </div>

      {selected.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            {isGroup ? <Users className="h-3.5 w-3.5" /> : null}
            <span>To: {selected.length} {selected.length === 1 ? "person" : "people"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {selected.map((s) => (
              <button
                key={s.id}
                onClick={() => toggle(s)}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs"
              >
                <Avatar path={s.avatar_url} name={s.display_name ?? s.username} size={20} />
                @{s.username} ×
              </button>
            ))}
          </div>
          {isGroup && (
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (optional)"
              className="mt-3"
              maxLength={60}
            />
          )}
          <Button
            onClick={start}
            disabled={busy}
            className="mt-3 w-full brand-gradient text-primary-foreground"
          >
            {busy ? "Starting…" : isGroup ? "Create group" : "Start chat"}
          </Button>
        </div>
      )}

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search people…"
        autoFocus
      />

      {loading && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      <ul className="space-y-1">
        {results.map((p) => {
          const picked = !!selected.find((s) => s.id === p.id);
          return (
            <li key={p.id}>
              <button
                onClick={() => toggle(p)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition ${
                  picked ? "bg-primary/10" : "hover:bg-muted/50"
                }`}
              >
                <Avatar path={p.avatar_url} name={p.display_name ?? p.username} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {p.display_name ?? p.username}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">@{p.username}</div>
                </div>
                {picked && <Check className="h-5 w-5 text-primary" />}
              </button>
            </li>
          );
        })}
        {q.trim() && !loading && results.length === 0 && (
          <li className="py-6 text-center text-xs text-muted-foreground">No people found</li>
        )}
      </ul>
    </div>
  );
}
