import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createBroadcast, dispatchDueBroadcasts } from "@/lib/ifriend/broadcast.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Megaphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/broadcast")({
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
  component: BroadcastPage,
});

type Row = {
  id: string;
  title: string;
  body: string;
  audience: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  push_sent: number;
  push_failed: number;
  email_status: string;
  email_sent: number;
  error: string | null;
  created_at: string;
};

type Person = { id: string; username: string; display_name: string | null };

function BroadcastPage() {
  const send = useServerFn(createBroadcast);
  const dispatch = useServerFn(dispatchDueBroadcasts);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [audience, setAudience] = useState<"all" | "selected">("all");
  const [sendEmail, setSendEmail] = useState(true);
  const [scheduleFor, setScheduleFor] = useState("");
  const [busy, setBusy] = useState(false);

  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Person[]>([]);
  const [history, setHistory] = useState<Row[]>([]);

  async function loadHistory() {
    const { data } = await (supabase as any)
      .from("broadcasts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory((data ?? []) as Row[]);
  }

  useEffect(() => {
    void (async () => {
      try {
        await dispatch({});
      } catch {
        /* scheduled dispatch is best-effort */
      }
      await loadHistory();
    })();
  }, [dispatch]);

  useEffect(() => {
    if (audience !== "selected" || q.trim().length < 2) {
      setPeople([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .ilike("username", `%${q.trim()}%`)
        .limit(10);
      setPeople((data ?? []) as Person[]);
    }, 250);
    return () => clearTimeout(t);
  }, [q, audience]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await send({
        data: {
          title,
          body,
          imageUrl: imageUrl || null,
          deepLink: deepLink || null,
          audience,
          targetUserIds: selected.map((p) => p.id),
          scheduledAt: scheduleFor ? new Date(scheduleFor).toISOString() : null,
          sendEmail,
        },
      });
      toast.success(res.status === "scheduled" ? "Broadcast scheduled" : "Broadcast sent");
      setTitle("");
      setBody("");
      setImageUrl("");
      setDeepLink("");
      setScheduleFor("");
      setSelected([]);
      await loadHistory();
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Megaphone className="h-5 w-5 text-primary" /> Broadcasts
        </h1>
        <Button asChild size="sm" variant="outline">
          <Link to="/admin">Back to admin</Link>
        </Button>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="t">Title</Label>
          <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b">Message</Label>
          <Textarea id="b" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={4} required />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="img">Image URL (optional)</Label>
            <Input id="img" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dl">Deep link (optional)</Label>
            <Input id="dl" value={deepLink} onChange={(e) => setDeepLink(e.target.value)} placeholder="/challenges" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Audience</Label>
          <div className="flex gap-2">
            {(["all", "selected"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                  audience === a
                    ? "border-transparent brand-gradient text-primary-foreground"
                    : "border-border bg-card"
                }`}
              >
                {a === "all" ? "Everyone" : "Selected people"}
              </button>
            ))}
          </div>
          {audience === "selected" && (
            <div className="space-y-2">
              <Input placeholder="Search username…" value={q} onChange={(e) => setQ(e.target.value)} />
              {people.length > 0 && (
                <div className="rounded-xl border border-border">
                  {people.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelected((s) => (s.some((x) => x.id === p.id) ? s : [...s, p]));
                        setQ("");
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      @{p.username}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {selected.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected((s) => s.filter((x) => x.id !== p.id))}
                    className="rounded-full bg-muted px-3 py-1 text-xs"
                  >
                    @{p.username} ✕
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sch">Schedule for later (optional)</Label>
            <Input id="sch" type="datetime-local" value={scheduleFor} onChange={(e) => setScheduleFor(e.target.value)} />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Also email this announcement
          </label>
        </div>

        <Button type="submit" disabled={busy} className="w-full brand-gradient text-primary-foreground">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {scheduleFor ? "Schedule broadcast" : "Send now"}
        </Button>
      </form>

      <div className="space-y-3">
        <h2 className="text-lg font-bold">History</h2>
        {history.length === 0 && <p className="text-sm text-muted-foreground">No broadcasts yet.</p>}
        {history.map((h) => (
          <div key={h.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold">{h.title}</div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase">{h.status}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{h.body}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
              <span>Audience: {h.audience === "all" ? "everyone" : "selected"}</span>
              <span>Push: {h.push_sent} sent / {h.push_failed} failed</span>
              <span>Email: {emailLabel(h.email_status)} ({h.email_sent})</span>
              <span>
                {h.sent_at
                  ? new Date(h.sent_at).toLocaleString()
                  : h.scheduled_at
                    ? `Scheduled ${new Date(h.scheduled_at).toLocaleString()}`
                    : new Date(h.created_at).toLocaleString()}
              </span>
            </div>
            {h.error && <p className="mt-1 text-[11px] text-destructive">{h.error}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function emailLabel(status: string) {
  if (status === "unavailable_no_sender_domain") return "needs sender domain";
  return status;
}
