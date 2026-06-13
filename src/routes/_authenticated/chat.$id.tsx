import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/ifriend/SignedImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Send, LogOut, Users, UserPlus, Link2, Settings, Trash2, Copy, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat/$id")({
  component: ChatRoom,
});

type Msg = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type ConvMeta = {
  is_group: boolean;
  name: string | null;
  description?: string | null;
  code?: string | null;
  avatar_url: string | null;
  created_by: string;
  title: string;
  display_avatar: string | null;
  other_username?: string | null;
};

function ChatRoom() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<ConvMeta | null>(null);
  const [members, setMembers] = useState<{ user_id: string; username: string; display_name: string | null }[]>([]);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadAll() {
    const { data: c } = await supabase
      .from("conversations")
      .select("is_group, name, description, code, avatar_url, created_by")
      .eq("id", id)
      .maybeSingle();
    if (!c) {
      toast.error("Chat not found");
      navigate({ to: "/inbox" });
      return;
    }

    const { data: mems } = await supabase
      .from("conversation_members")
      .select("user_id, profiles!conversation_members_user_id_fkey(username, display_name, avatar_url)")
      .eq("conversation_id", id);
    const memberList = (mems ?? []).map((m: any) => ({
      user_id: m.user_id,
      username: m.profiles?.username ?? "user",
      display_name: m.profiles?.display_name ?? null,
      avatar_url: m.profiles?.avatar_url ?? null,
    }));
    setMembers(memberList);

    let title = c.name ?? "Group";
    let display_avatar = c.avatar_url;
    let other_username: string | null = null;
    if (!c.is_group) {
      const other = memberList.find((m) => m.user_id !== user.id);
      title = other?.display_name ?? other?.username ?? "User";
      display_avatar = other?.avatar_url ?? null;
      other_username = other?.username ?? null;
    }
    setMeta({ ...c, title, display_avatar, other_username });

    const { data: ms } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at, profiles!messages_sender_id_fkey(username, display_name, avatar_url)")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(200);
    setMsgs(
      (ms ?? []).map((m: any) => ({
        id: m.id,
        sender_id: m.sender_id,
        content: m.content,
        created_at: m.created_at,
        username: m.profiles?.username ?? "user",
        display_name: m.profiles?.display_name ?? null,
        avatar_url: m.profiles?.avatar_url ?? null,
      })),
    );

    // mark read
    await supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", id)
      .eq("user_id", user.id);
  }

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("chat-" + id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        async (payload: any) => {
          const m = payload.new;
          const { data: p } = await supabase
            .from("profiles")
            .select("username, display_name, avatar_url")
            .eq("id", m.sender_id)
            .maybeSingle();
          setMsgs((cur) => [
            ...(cur ?? []),
            {
              id: m.id,
              sender_id: m.sender_id,
              content: m.content,
              created_at: m.created_at,
              username: p?.username ?? "user",
              display_name: p?.display_name ?? null,
              avatar_url: p?.avatar_url ?? null,
            },
          ]);
          await supabase
            .from("conversation_members")
            .update({ last_read_at: new Date().toISOString() })
            .eq("conversation_id", id)
            .eq("user_id", user.id);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setSending(true);
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: id, sender_id: user.id, content });
    setSending(false);
    if (error) return toast.error("Couldn't send");
    setText("");
  }

  async function leave() {
    if (!confirm("Leave this conversation?")) return;
    const { error } = await supabase
      .from("conversation_members")
      .delete()
      .eq("conversation_id", id)
      .eq("user_id", user.id);
    if (error) return toast.error("Couldn't leave");
    navigate({ to: "/inbox" });
  }

  if (!meta || msgs === null) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="-mx-4 -mt-4 flex h-[calc(100vh-12rem)] flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <Link to="/inbox" className="rounded-full p-1.5 text-muted-foreground hover:text-foreground" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {meta.is_group ? (
          <div className="flex flex-1 items-center gap-3">
            <div className="relative">
              <Avatar path={meta.display_avatar} name={meta.title} size={40} />
              <span className="absolute -bottom-1 -right-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                <Users className="h-3 w-3" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{meta.title}</div>
              <div className="truncate text-[11px] text-muted-foreground">{members.length} members</div>
            </div>
          </div>
        ) : (
          <Link
            to="/p/$username"
            params={{ username: meta.other_username ?? "" }}
            className="flex flex-1 items-center gap-3"
          >
            <Avatar path={meta.display_avatar} name={meta.title} size={40} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{meta.title}</div>
              {meta.other_username && (
                <div className="truncate text-[11px] text-muted-foreground">@{meta.other_username}</div>
              )}
            </div>
          </Link>
        )}
        {meta.is_group && (
          <>
            <button
              onClick={async () => {
                const link = meta.code
                  ? `${window.location.origin}/groups/join`
                  : null;
                const { data, error } = await supabase.rpc("create_conversation_invite", { _conv: id });
                if (error || !data) return toast.error("Couldn't create invite");
                const inviteLink = `${window.location.origin}/join/${data}`;
                const shareText = meta.code
                  ? `Join "${meta.title}" on iFriend!\nCode: ${meta.code}\nOr tap: ${inviteLink}`
                  : `Join "${meta.title}" on iFriend: ${inviteLink}`;
                try {
                  if (navigator.share) await navigator.share({ title: meta.title, text: shareText, url: inviteLink });
                  else { await navigator.clipboard.writeText(shareText); toast.success("Invite copied"); }
                } catch { /* cancelled */ }
                void link;
              }}
              className="rounded-full p-2 text-muted-foreground hover:text-foreground"
              aria-label="Invite friends"
              title="Invite friends"
            >
              <Link2 className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowAdd((s) => !s)}
              className="rounded-full p-2 text-muted-foreground hover:text-foreground"
              aria-label="Add member"
            >
              <UserPlus className="h-5 w-5" />
            </button>
            {meta.created_by === user.id && (
              <button
                onClick={() => setShowSettings((s) => !s)}
                className="rounded-full p-2 text-muted-foreground hover:text-foreground"
                aria-label="Group settings"
                title="Group settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            )}
          </>
        )}
        <button
          onClick={leave}
          className="rounded-full p-2 text-muted-foreground hover:text-destructive"
          aria-label="Leave"
          title="Leave"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {showAdd && meta.is_group && (
        <AddMemberPanel
          conversationId={id}
          existingIds={members.map((m) => m.user_id)}
          onAdded={() => {
            setShowAdd(false);
            loadAll();
          }}
        />
      )}

      {showSettings && meta.is_group && meta.created_by === user.id && (
        <GroupSettingsPanel
          conversationId={id}
          meta={meta}
          members={members}
          currentUserId={user.id}
          onChanged={loadAll}
          onClose={() => setShowSettings(false)}
          onDeleted={() => navigate({ to: "/groups" })}
        />
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {msgs.length === 0 && (
          <p className="py-10 text-center text-xs text-muted-foreground">
            Say hi 👋
          </p>
        )}
        <div className="space-y-2">
          {msgs.map((m, i) => {
            const mine = m.sender_id === user.id;
            const prev = msgs[i - 1];
            const showName = meta.is_group && !mine && (!prev || prev.sender_id !== m.sender_id);
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "rounded-br-sm brand-gradient text-primary-foreground"
                      : "rounded-bl-sm border border-border bg-card"
                  }`}
                >
                  {showName && (
                    <div className="mb-0.5 text-[10px] font-semibold text-accent">@{m.username}</div>
                  )}
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  <div className={`mt-0.5 text-right text-[9px] ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-border bg-background px-4 py-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
          maxLength={2000}
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || !text.trim()}
          className="brand-gradient text-primary-foreground"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function AddMemberPanel({
  conversationId,
  existingIds,
  onAdded,
}: {
  conversationId: string;
  existingIds: string[];
  onAdded: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; username: string; display_name: string | null; avatar_url: string | null }[]>([]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(8);
      setResults((data ?? []).filter((p: any) => !existingIds.includes(p.id)));
    }, 200);
    return () => clearTimeout(t);
  }, [q, existingIds]);

  async function add(uid: string) {
    const { error } = await supabase.rpc("add_conversation_member", {
      _conv: conversationId,
      _user: uid,
    });
    if (error) return toast.error("Couldn't add");
    toast.success("Added");
    onAdded();
  }

  return (
    <div className="border-b border-border bg-muted/30 px-4 py-3">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search to add…" />
      {results.length > 0 && (
        <ul className="mt-2 space-y-1">
          {results.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => add(p.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
              >
                <Avatar path={p.avatar_url} name={p.display_name ?? p.username} size={32} />
                <div className="text-sm">
                  <div className="font-semibold">{p.display_name ?? p.username}</div>
                  <div className="text-xs text-muted-foreground">@{p.username}</div>
                </div>
                <UserPlus className="ml-auto h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
