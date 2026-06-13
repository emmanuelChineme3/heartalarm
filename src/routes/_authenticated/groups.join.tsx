import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Loader2, LogIn } from "lucide-react";

export const Route = createFileRoute("/_authenticated/groups/join")({
  component: JoinGroup,
});

function JoinGroup() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function join() {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("join_conversation_by_code", { _code: c });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "Invalid code");
      return;
    }
    toast.success("Joined group");
    navigate({ to: "/chat/$id", params: { id: data as string } });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/groups" className="rounded-full p-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Join Group</h1>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card p-6">
        <div className="rounded-full brand-gradient p-3 text-primary-foreground">
          <LogIn className="h-6 w-6" />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Enter the 8-character code your friend shared with you.
        </p>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD2345"
          maxLength={8}
          className="text-center font-mono text-lg tracking-widest"
          autoFocus
        />
        <Button onClick={join} disabled={busy || !code.trim()} className="w-full brand-gradient text-primary-foreground">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Group"}
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Got an invite link? Just tap it — you'll be added automatically.
      </p>
    </div>
  );
}
