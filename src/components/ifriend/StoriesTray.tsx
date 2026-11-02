import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/ifriend/SignedImage";
import { Plus } from "lucide-react";

type StoryRow = {
  id: string;
  user_id: string;
  created_at: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export function StoriesTray({ currentUserId }: { currentUserId: string }) {
  const { data } = useQuery({
    queryKey: ["stories-tray"],
    queryFn: async (): Promise<StoryRow[]> => {
      const { data, error } = await (supabase as any)
        .from("stories")
        .select("id, user_id, created_at, profiles!stories_user_id_fkey(username, display_name, avatar_url)")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        const r = await (supabase as any)
          .from("stories")
          .select("id, user_id, created_at")
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(50);
        const ids: string[] = Array.from(new Set((r.data ?? []).map((s: any) => String(s.user_id))));
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", ids);
        const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
        return (r.data ?? []).map((s: any) => ({
          id: s.id,
          user_id: s.user_id,
          created_at: s.created_at,
          username: map.get(s.user_id)?.username ?? "user",
          display_name: map.get(s.user_id)?.display_name ?? null,
          avatar_url: map.get(s.user_id)?.avatar_url ?? null,
        }));
      }
      return (data ?? []).map((s: any) => ({
        id: s.id,
        user_id: s.user_id,
        created_at: s.created_at,
        username: s.profiles?.username ?? "user",
        display_name: s.profiles?.display_name ?? null,
        avatar_url: s.profiles?.avatar_url ?? null,
      }));
    },
    refetchInterval: 60_000,
  });

  // dedupe one bubble per user, newest story id
  const seen = new Set<string>();
  const bubbles = (data ?? []).filter((s) => {
    if (seen.has(s.user_id)) return false;
    seen.add(s.user_id);
    return true;
  });

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
      <Link
        to="/stories/new"
        className="flex w-16 shrink-0 flex-col items-center gap-1"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-primary text-primary">
          <Plus className="h-6 w-6" />
        </div>
        <span className="text-[10px] text-muted-foreground">Your story</span>
      </Link>
      {bubbles.map((s) => (
        <Link
          key={s.id}
          to="/stories/$id"
          params={{ id: s.id }}
          className="flex w-16 shrink-0 flex-col items-center gap-1"
        >
          <div className="rounded-full p-[2px] brand-gradient">
            <div className="rounded-full bg-background p-[2px]">
              <Avatar path={s.avatar_url} name={s.display_name ?? s.username} size={56} />
            </div>
          </div>
          <span className="w-16 truncate text-center text-[10px] text-muted-foreground">
            {s.user_id === currentUserId ? "You" : s.username}
          </span>
        </Link>
      ))}
    </div>
  );
}
