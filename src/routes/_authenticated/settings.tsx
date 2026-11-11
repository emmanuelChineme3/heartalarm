import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/ifriend/SignedImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Camera } from "lucide-react";
import {
  getPushState,
  registerPushNotifications,
  subscribePushState,
  type PushState,
} from "@/lib/ifriend/pushRegister";
import { isNativeApp } from "@/lib/ifriend/native";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, display_name, bio, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (data) {
        setUsername(data.username ?? "");
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setAvatarPath(data.avatar_url ?? null);
      }

      setLoading(false);
    })();
  }, [user.id]);

  async function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    if (f.size > 5 * 1024 * 1024) {
      return toast.error("Image must be under 5MB");
    }

    const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error
