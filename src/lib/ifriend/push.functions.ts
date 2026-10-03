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
    const { sendFcmMessage } = await import("@/lib/ifriend/fcm.server");

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

    const { invalid } = await sendFcmMessage(tokens, {
      title: "💗 Heart Alarm",
      body: "Someone has a heart for your vibe — open to reveal.",
      link: "/?ring=1",
      type: "ring",
    });
    if (invalid.length > 0) {
      await supabaseAdmin.from("device_tokens").delete().in("token", invalid);
    }
    return { sent: tokens.length - invalid.length };
  });

/** Sends a Heart Alarm push notification directly to a user (Ring a Friend). */
export const notifyRingUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { receiverId: string }) => input)
  .handler(async ({ data, context }) => {
    if (!data.receiverId || data.receiverId === context.userId) return { sent: 0 };
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { sendFcmMessage } = await import("@/lib/ifriend/fcm.server");

    const { data: rows } = await supabaseAdmin
      .from("device_tokens")
      .select("token")
      .eq("user_id", data.receiverId);

    const tokens = (rows ?? []).map((r: { token: string }) => r.token);
    if (tokens.length === 0) return { sent: 0 };

    const { invalid } = await sendFcmMessage(tokens, {
      title: "💗 Heart Alarm",
      body: "Someone has a heart for your vibe — open to reveal.",
      link: "/?ring=1",
      type: "ring",
    });
    if (invalid.length > 0) {
      await supabaseAdmin.from("device_tokens").delete().in("token", invalid);
    }
    return { sent: tokens.length - invalid.length };
  });

/** Push for a new chat message to every other member of the conversation. */
export const notifyMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; preview: string }) => input)
  .handler(async ({ data, context }) => {
    // Caller must be a member (RLS-scoped check as the user).
    const { data: mine } = await context.supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", data.conversationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!mine) return { sent: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendFcmMessage } = await import("@/lib/ifriend/fcm.server");
    const { data: members } = await supabaseAdmin
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", data.conversationId)
      .neq("user_id", context.userId);
    const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
    if (ids.length === 0) return { sent: 0 };
    const { data: me } = await supabaseAdmin
      .from("profiles").select("username, display_name").eq("id", context.userId).maybeSingle();
    const { data: rows } = await supabaseAdmin
      .from("device_tokens").select("token").in("user_id", ids);
    const tokens = (rows ?? []).map((r: { token: string }) => r.token);
    if (tokens.length === 0) return { sent: 0 };
    const name = (me as any)?.display_name || (me as any)?.username || "New message";
    const { sent, invalid } = await sendFcmMessage(tokens, {
      title: `💬 ${name}`,
      body: String(data.preview ?? "").slice(0, 120) || "Sent you a message",
      link: `/chat/${data.conversationId}`,
      type: "message",
    });
    if (invalid.length > 0) {
      await supabaseAdmin.from("device_tokens").delete().in("token", invalid);
    }
    return { sent };
  });
