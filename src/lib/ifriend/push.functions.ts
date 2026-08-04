import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sends a Heart Alarm push notification to the owner of a post. */
export const notifyRing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { postId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { sendFcm } = await import("@/lib/ifriend/fcm.server");

    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("user_id")
      .eq("id", data.postId)
      .maybeSingle();

    const receiverId = (post as { user_id?: string } | null)?.user_id;
    if (!receiverId || receiverId === context.userId) return { sent: 0 };

    const { data: rows } = await supabaseAdmin
      .from("device_tokens")
      .select("token")
      .eq("user_id", receiverId);

    const tokens = (rows ?? []).map((r: { token: string }) => r.token);
    if (tokens.length === 0) return { sent: 0 };

    const invalid = await sendFcm(
      tokens,
      "💗 Heart Alarm",
      "Someone has a heart for your vibe — open to reveal.",
    );
    if (invalid.length > 0) {
      await supabaseAdmin.from("device_tokens").delete().in("token", invalid);
    }
    return { sent: tokens.length - invalid.length };
  });
