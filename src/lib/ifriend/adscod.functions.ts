import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Fetches one Adscod ad for the in-app Feed or Stories slot. */
export const getAdscodAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slot: "feed" | "stories" }) => {
    if (input.slot !== "feed" && input.slot !== "stories") throw new Error("Bad slot");
    return input;
  })
  .handler(async ({ data }) => {
    const { fetchAdscodAd } = await import("@/lib/ifriend/adscod.server");
    return { ad: await fetchAdscodAd(data.slot) };
  });

/** Admin-only: sends one Adscod Push-placement ad as a notification to all devices. */
export const sendAdscodPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { fetchAdscodAd } = await import("@/lib/ifriend/adscod.server");
    const ad = await fetchAdscodAd("push");
    if (!ad) return { sent: 0, reason: "no_ad" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendFcmMessage } = await import("@/lib/ifriend/fcm.server");
    const { data: rows } = await supabaseAdmin.from("device_tokens").select("token");
    const tokens = (rows ?? []).map((r: { token: string }) => r.token);
    const { sent, invalid } = await sendFcmMessage(tokens, {
      title: `Sponsored · ${ad.brandName ?? ad.title}`,
      body: ad.body ?? ad.title,
      imageUrl: ad.imageUrl,
      adUrl: ad.clickUrl,
      type: "ad",
    });
    if (invalid.length > 0) {
      await supabaseAdmin.from("device_tokens").delete().in("token", invalid);
    }
    return { sent, reason: null };
  });
