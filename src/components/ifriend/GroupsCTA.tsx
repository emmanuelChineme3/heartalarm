import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, LogIn, Users } from "lucide-react";

export function GroupsCTA({ userId }: { userId: string }) {
  const [hasGroup, setHasGroup] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("conversation_members")
        .select("conversation_id, conversations!inner(is_group)")
        .eq("user_id", userId)
        .limit(50);
      if (cancelled) return;
      const any = (data ?? []).some((m: any) => m.conversations?.is_group);
      setHasGroup(any);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (hasGroup === null || hasGroup) return null;

  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full brand-gradient p-1.5 text-primary-foreground">
          <Users className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-sm font-bold">Stay with your friends in a Group</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Chat in real time, share moments, and invite friends with a link.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Link
          to="/groups/new"
          className="flex items-center justify-center gap-1.5 rounded-xl brand-gradient px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Create Group
        </Link>
        <Link
          to="/groups/join"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
        >
          <LogIn className="h-3.5 w-3.5" /> Join Group
        </Link>
      </div>
    </div>
  );
}
