import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/ifriend/SignedImage";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/search")({
  component: SearchPage,
});

type ProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const query = supabase.from("profiles").select("id, username, display_name, avatar_url, bio").limit(30);
      const { data, error } = term
        ? await query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
        : await query.order("created_at", { ascending: false });
      if (cancelled) return;
      if (!error) setResults((data ?? []) as ProfileRow[]);
      setLoading(false);
    };
    const t = setTimeout(run, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Search people…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
        {results.map((p) => (
          <li key={p.id}>
            <Link
              to="/p/$username"
              params={{ username: p.username }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted"
            >
              <Avatar path={p.avatar_url} name={p.display_name ?? p.username} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{p.display_name ?? p.username}</div>
                <div className="truncate text-xs text-muted-foreground">@{p.username}</div>
              </div>
            </Link>
          </li>
        ))}
        {!loading && results.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">No people found.</li>
        )}
      </ul>
    </div>
  );
}
