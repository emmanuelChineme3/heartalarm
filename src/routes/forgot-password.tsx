import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Check your email for the reset link");
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full brand-gradient opacity-30 blur-3xl" />
      <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card/70 p-7 backdrop-blur-xl glow">
        <h1 className="text-center text-3xl font-extrabold brand-text">Forgot password</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Enter your email and we'll send a reset link.
        </p>

        {sent ? (
          <div className="mt-6 space-y-4 text-center">
            <p className="text-sm">Check <span className="font-semibold">{email}</span> for a link to reset your password.</p>
            <Link to="/auth" className="inline-block text-sm text-muted-foreground hover:text-foreground">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full brand-gradient text-primary-foreground hover:opacity-90">
              {loading ? "Sending…" : "Send reset link"}
            </Button>
            <Link to="/auth" className="block text-center text-sm text-muted-foreground hover:text-foreground">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
