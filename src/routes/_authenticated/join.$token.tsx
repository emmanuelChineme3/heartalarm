import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/join/$token")({
  component: JoinByToken,
});

function JoinByToken() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("join_conversation_by_token", { _token: token });
      if (error || !data) {
        setErr(error?.message ?? "Invalid or expired invite");
        return;
      }
      toast.success("Joined group");
      navigate({ to: "/chat/$id", params: { id: data as string }, replace: true });
    })();
  }, [token, navigate]);

  if (err) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-destructive">{err}</p>
      </div>
    );
  }
  return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
