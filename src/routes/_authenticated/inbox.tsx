import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/ifriend/SignedImage";
import { Loader2, PenSquare, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inbox")({
  component: Inbox,
});

type Row = {
  id: string;
  is_group: boolean;
  name: string | null;
  avatar_url: string | null;
  last_message_at: string;
  last_read_at: string;
  other_username: string | null;
  other_display_name: string | null;
  other_avatar: string | null;
  last_content: string | null;
  unread: number;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function Inbox() {
  const { user } = Route.useRouteContext();
  const [rows, setRows] = useState<Row[] | null>(null);

  async function load() {
    const { data: memberships } = await supabase
      .from("conversation_members")
      .select("conversation_id, last_read_at, conversations(id, is_group, name, avatar_url, last_message_at)")
      .eq("user_id", user.id);
    const convs = (memberships ?? [])
      .map((m: any) => ({ ...m.conversations, last_read_at: m.last_read_at }))
      .filter((c: any) => c?.id)
      .sort((a: any, b: any) => +new Date(b.last_message_at) - +new Date(a.last_message_at));

    const ids = convs.map((c: any) => c.id);
    if (ids.length === 0) {
      setRows([]);
      return;
    }

    // last messages
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, conversation_id, content, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false });
    const lastMsg = new Map<string, any>();
    const unread = new Map<string, number>();
    (msgs ?? []).forEach((m: any) => {
      if (!lastMsg.has(m.conversation_id)) lastMsg.set(m.conversation_id, m);
    });

    // other-user lookup for DMs
    const dmIds = convs.filter((c: any) => !c.is_group).map((c: any) => c.id);
    const otherMap = new Map<string, any>();
    if (dmIds.length) {
      const { data: others } = await supabase
        .from("conversation_members")
        .select("conversation_id, user_id, profiles!conversation_members_user_id_fkey(username, display_name, avatar_url)")
        .in("conversation_id", dmIds)
        .neq("user_id", user.id);
      (others ?? []).forEach((o: any) => otherMap.set(o.conversation_id, o.profiles));
    }

    // unread counts
    for (const c of convs) {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", c.id)
        .gt("created_at", c.last_read_at)
        .neq("sender_id", user.id);
      unread.set(c.id, count ?? 0);
    }

    setRows(
      convs.map((c: any) => {
        const other = otherMap.get(c.id);
        const lm = lastMsg.get(c.id);
        return {
          id: c.id,
          is_group: c.is_group,
          name: c.name,
          avatar_url: c.avatar_url,
          last_message_at: c.last_message_at,
          last_read_at: c.last_read_at,
          other_username: other?.username ?? null,
          other_display_name: other?.display_name ?? null,
          other_avatar: other?.avatar_url ?? null,
          last_content: lm?.content ?? null,
          unread: unread.get(c.id) ?? 0,
        };
      }),
    );
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("inbox-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  if (rows === null) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          Messages
          {rows.reduce((n, r) => n + r.unread, 0) > 0 && (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-2 text-xs font-bold text-accent-foreground">
              {rows.reduce((n, r) => n + r.unread, 0)}
            </span>
          )}
        </h1>

        <Link
          to="/new-chat"
          className="inline-flex items-center gap-1.5 rounded-full brand-gradient px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <PenSquare className="h-3.5 w-3.5" /> New
        </Link>
      </div>

      {rows.length === 0 && (
        <div className="rounded-3xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">No conversations yet. Start one!</p>
        </div>
      )}

      <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
        {rows.map((r) => {
          const title = r.is_group
            ? r.name ?? "Group chat"
            : r.other_display_name ?? r.other_username ?? "User";
          const avatar = r.is_group ? r.avatar_url : r.other_avatar;
          return (
            <li key={r.id}>
              <Link
                to="/chat/$id"
                params={{ id: r.id }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40"
              >
                <div className="relative">
                  <Avatar path={avatar} name={title} size={48} />
                  {r.is_group && (
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                      <Users className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{title}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(r.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {r.last_content ?? "No messages yet"}
                    </span>
                    {r.unread > 0 && (
                      <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">
                        {r.unread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
