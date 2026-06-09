import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";

export function FollowButton({
  currentUserId,
  targetUserId,
  onChange,
}: {
  currentUserId: string;
  targetUserId: string;
  onChange?: (following: boolean) => void;
}) {
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", currentUserId)
        .eq("following_id", targetUserId)
        .maybeSingle();
      if (active) setFollowing(!!data);
    })();
    return () => {
      active = false;
    };
  }, [currentUserId, targetUserId]);

  async function toggle() {
    if (following === null) return;
    setBusy(true);
    if (following) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", targetUserId);
      if (error) {
        toast.error("Couldn't unfollow");
      } else {
        setFollowing(false);
        onChange?.(false);
      }
    } else {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: currentUserId, following_id: targetUserId });
      if (error) {
        toast.error("Couldn't follow");
      } else {
        setFollowing(true);
        onChange?.(true);
      }
    }
    setBusy(false);
  }

  if (following === null) {
    return (
      <Button disabled variant="outline" className="w-full">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading
      </Button>
    );
  }

  return (
    <Button
      onClick={toggle}
      disabled={busy}
      variant={following ? "outline" : "default"}
      className={following ? "w-full" : "w-full brand-gradient text-primary-foreground"}
    >
      {following ? (
        <>
          <UserCheck className="mr-2 h-4 w-4" /> Following
        </>
      ) : (
        <>
          <UserPlus className="mr-2 h-4 w-4" /> Follow
        </>
      )}
    </Button>
  );
}
