import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/ifriend/SignedImage";
import { Loader2, Plus, LogIn, Users, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/groups/")({
  component: GroupsList,
});

type GroupRow = {
  id: string;
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  code: string | null;
  member_count: number;
  last_message_at: string;
};

function GroupsList() {
  const { user } = Route.useRouteContext();
  const [rows, setRows] = useState<GroupRow[] | null>(null);

  async function load() {
    const { data: memberships } = await supabase
      .from("conversation_members")
      .select("conversation_id, conversations!inner(id, is_group, name, description, avatar_url, code, last_message_at)")
      .eq("user_id", user.id);
    const groups = (memberships ?? [])
      .map((m: any) => m.conversations)
      .filter((c: any) => c?.is_group)
      .sort((a: any, b: any) => +new Date(b.last_message_at) - +new Date(a.last_message_at));

    const ids = groups.map((g: any) => g.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: members } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .in("conversation_id", ids);
      (members ?? []).forEach((m: any) => counts.set(m.conversation_id, (counts.get(m.conversation_id) ?? 0) + 1));
    }

    setRows(
      groups.map((g: any) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        avatar_url: g.avatar_url,
        code: g.code,
        last_message_at: g.last_message_at,
        member_count: counts.get(g.id) ?? 1,
      })),
    );
  }

  useEffect(() => {
    load();
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Groups</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/groups/new"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl brand-gradient p-5 text-primary-foreground shadow-md"
        >
          <Plus className="h-6 w-6" />
          <span className="text-sm font-semibold">Create Group</span>
        </Link>
        <Link
          to="/groups/join"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-5"
        >
          <LogIn className="h-6 w-6 text-primary" />
          <span className="text-sm font-semibold">Join Group</span>
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-8 text-center">
          <Sparkles className="mx-auto mb-2 h-8 w-8 text-primary" />
          <h2 className="text-base font-semibold">No groups yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first group or join one with a code from a friend.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
          {rows.map((g) => (
            <li key={g.id}>
              <Link
                to="/chat/$id"
                params={{ id: g.id }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40"
              >
                <div className="relative">
                  <Avatar path={g.avatar_url} name={g.name ?? "Group"} size={48} />
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                    <Users className="h-3 w-3" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{g.name ?? "Group"}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {g.member_count} {g.member_count === 1 ? "member" : "members"}
                    {g.code && <span className="ml-2 font-mono text-[10px] opacity-70">#{g.code}</span>}
                  </div>
                  {g.description && (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground/80">{g.description}</div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
