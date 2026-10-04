import { createFileRoute, useRouter, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { recordConsent } from "@/lib/legal/consent";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && !agreed) {
      toast.error("Please accept the Privacy Policy and Terms & Conditions");
      return;
    }
    let authEmail = email;
    if (method === "phone") {
      const digits = phone.replace(/[^\d]/g, "");
      if (digits.length < 7) {
        toast.error("Enter a valid phone number with country code");
        return;
      }
      authEmail = `${digits}@phone.heartalarm.app`;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: method === "phone" ? { username, phone } : { username },
          },
        });
        if (error) throw error;
        await recordConsent(data.user?.id ?? null);
        toast.success("Welcome to Heart Alarm!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
        if (error) throw error;
      }
      router.navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function signInGoogle() {
    if (mode === "signup" && !agreed) {
      toast.error("Please accept the Privacy Policy and Terms & Conditions");
      return;
    }
    if (mode === "signup") {
      // OAuth navigates away; finish recording consent on return.
      localStorage.setItem("ha_pending_consent", "1");
    }
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) {
      toast.error(r.error.message ?? "Google sign-in failed");
      return;
    }
    if (r.redirected) return;
    const { data } = await supabase.auth.getUser();
    if (mode === "signup") await recordConsent(data.user?.id ?? null);
    router.navigate({ to: "/" });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full brand-gradient opacity-30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full brand-gradient opacity-20 blur-3xl" />

      <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card/70 p-7 backdrop-blur-xl glow">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold brand-text">Heart Alarm</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? "Welcome back." : "Create your account."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="yourname"
                required
                minLength={2}
                maxLength={20}
                pattern="[a-zA-Z0-9_]+"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-xs font-semibold">
            {(["email", "phone"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`rounded-full py-1.5 ${method === m ? "brand-gradient text-primary-foreground" : "text-muted-foreground"}`}
              >
                {m === "email" ? "Email" : "Phone number"}
              </button>
            ))}
          </div>
          {method === "email" ? (
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" type="tel" inputMode="tel" placeholder="+234 801 234 5678" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {mode === "signin" && method === "email" && (
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                Forgot password?
              </Link>
            </div>
          )}
          {mode === "signup" && (
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                aria-label="I have read and agree to the Privacy Policy and Terms & Conditions"
              />
              <span>
                I have read and agree to the{" "}
                <Link to="/privacy" target="_blank" className="font-semibold text-foreground underline">
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link to="/terms" target="_blank" className="font-semibold text-foreground underline">
                  Terms &amp; Conditions
                </Link>
                .
              </span>
            </label>
          )}
          <Button
            type="submit"
            disabled={loading || (mode === "signup" && !agreed)}
            className="w-full brand-gradient text-primary-foreground hover:opacity-90"
          >
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          OR
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          variant="outline"
          onClick={signInGoogle}
          disabled={mode === "signup" && !agreed}
          className="w-full"
        >
          Continue with Google
        </Button>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-5 block w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
