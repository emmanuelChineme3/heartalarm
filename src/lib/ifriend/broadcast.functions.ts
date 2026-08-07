import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BroadcastInput = {
  title: string;
  body: string;
  imageUrl?: string | null;
  deepLink?: string | null;
  audience: "all" | "selected";
  targetUserIds?: string[];
  /** ISO timestamp; when set in the future the broadcast is queued. */
  scheduledAt?: string | null;
  sendEmail: boolean;
};

function validate(input: BroadcastInput): BroadcastInput {
  const title = String(input.title ?? "").trim();
  const body = String(input.body ?? "").trim();
  if (title.length < 2 || title.length > 100) throw new Error("Title must be 2–100 characters");
  if (body.length < 2 || body.length > 1000) throw new Error("Message must be 2–1000 characters");
  const imageUrl = input.imageUrl?.trim() || null;
  if (imageUrl && !/^https:\/\/\S+$/i.test(imageUrl)) throw new Error("Image must be an https URL");
  const deepLink = input.deepLink?.trim() || null;
  if (deepLink && !/^\/[A-Za-z0-9\-_/$.]*$/.test(deepLink)) {
    throw new Error("Deep link must be an in-app path like /challenges");
  }
  const audience = input.audience === "selected" ? "selected" : "all";
  const targetUserIds = (input.targetUserIds ?? []).slice(0, 5000);
  if (audience === "selected" && targetUserIds.length === 0) {
    throw new Error("Pick at least one person");
  }
  return {
    title,
    body,
    imageUrl,
    deepLink,
    audience,
    targetUserIds,
    scheduledAt: input.scheduledAt || null,
    sendEmail: !!input.sendEmail,
  };
}

/** Creates a broadcast and sends it now, or queues it for its scheduled time. */
export const createBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BroadcastInput) => validate(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scheduled = data.scheduledAt && new Date(data.scheduledAt).getTime() > Date.now();

    const { data: row, error } = await (supabaseAdmin as any)
      .from("broadcasts")
      .insert({
        created_by: context.userId,
        title: data.title,
        body: data.body,
        image_url: data.imageUrl,
        deep_link: data.deepLink,
        audience: data.audience,
        target_user_ids: data.targetUserIds ?? [],
        scheduled_at: data.scheduledAt,
        status: scheduled ? "scheduled" : "sending",
        email_status: data.sendEmail ? "pending" : "skipped",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (scheduled) return { id: row.id as string, status: "scheduled" as const };

    const result = await deliver(row.id as string);
    return { id: row.id as string, status: "sent" as const, ...result };
  });

/** Sends any scheduled broadcast whose time has arrived. Safe to call often. */
export const dispatchDueBroadcasts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: due } = await (supabaseAdmin as any)
      .from("broadcasts")
      .select("id")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .limit(5);

    let processed = 0;
    for (const b of (due ?? []) as { id: string }[]) {
      const { data: claimed } = await (supabaseAdmin as any)
        .from("broadcasts")
        .update({ status: "sending" })
        .eq("id", b.id)
        .eq("status", "scheduled")
        .select("id");
      if (!claimed || claimed.length === 0) continue;
      await deliver(b.id);
      processed += 1;
    }
    return { processed };
  });

/** Performs the actual push + email fan-out for a broadcast row. */
async function deliver(broadcastId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendFcmMessage } = await import("@/lib/ifriend/fcm.server");

  const { data: b } = await (supabaseAdmin as any)
    .from("broadcasts")
    .select("*")
    .eq("id", broadcastId)
    .maybeSingle();
  if (!b) return { pushSent: 0, emailStatus: "failed" };

  try {
    // ── Recipients ────────────────────────────────────────────────────────
    let userIds: string[] | null = null;
    if (b.audience === "selected") userIds = (b.target_user_ids ?? []) as string[];

    let tokenQuery = (supabaseAdmin as any).from("device_tokens").select("token, user_id");
    if (userIds) tokenQuery = tokenQuery.in("user_id", userIds);
    const { data: tokenRows } = await tokenQuery;
    const tokens = Array.from(
      new Set(((tokenRows ?? []) as { token: string }[]).map((r) => r.token)),
    );

    const { sent, invalid } = await sendFcmMessage(tokens, {
      title: b.title,
      body: b.body,
      imageUrl: b.image_url,
      link: b.deep_link,
      type: "broadcast",
    });
    if (invalid.length > 0) {
      await (supabaseAdmin as any).from("device_tokens").delete().in("token", invalid);
    }

    // ── Email ─────────────────────────────────────────────────────────────
    const email = b.email_status === "skipped"
      ? { status: "skipped", sent: 0, failed: 0 }
      : await sendBroadcastEmails(userIds, b.title, b.body);

    await (supabaseAdmin as any)
      .from("broadcasts")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        push_sent: sent,
        push_failed: Math.max(0, tokens.length - sent),
        email_sent: email.sent,
        email_failed: email.failed,
        email_status: email.status,
      })
      .eq("id", broadcastId);

    return { pushSent: sent, pushTotal: tokens.length, emailStatus: email.status };
  } catch (e: any) {
    await (supabaseAdmin as any)
      .from("broadcasts")
      .update({ status: "failed", error: e?.message ?? String(e) })
      .eq("id", broadcastId);
    throw e;
  }
}

/**
 * Emails the announcement to recipients' registered addresses.
 * Requires a verified sender domain for the project; without one we record the
 * reason instead of silently reporting success.
 */
async function sendBroadcastEmails(
  userIds: string[] | null,
  title: string,
  body: string,
): Promise<{ status: string; sent: number; failed: number }> {
  const sender = process.env["EMAIL_SENDER_DOMAIN"];
  if (!sender) {
    return { status: "unavailable_no_sender_domain", sent: 0, failed: 0 };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const emails: string[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) {
      if (!u.email) continue;
      if (userIds && !userIds.includes(u.id)) continue;
      emails.push(u.email);
    }
    if (data.users.length < 200) break;
    page += 1;
  }

  let sent = 0;
  let failed = 0;
  for (const to of emails) {
    try {
      const res = await fetch(
        `${process.env["APP_ORIGIN"] ?? ""}/lovable/email/transactional/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateName: "broadcast",
            recipientEmail: to,
            templateData: { title, body },
          }),
        },
      );
      if (res.ok) sent += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { status: failed === 0 ? "sent" : "partial", sent, failed };
}
