import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DAILY_RING_LIMIT = 3;
export const RING_LIMIT_MESSAGE =
  "You've used all 3 Heart Alarm rings for today. Come back tomorrow.";

/** Today's date in the user's LOCAL timezone as YYYY-MM-DD. */
export function localDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function fetchRingsLeft(): Promise<number> {
  const { data, error } = await (supabase as any).rpc("rings_left_today", {
    _local_date: localDate(),
  });
  if (error) return DAILY_RING_LIMIT;
  return typeof data === "number" ? data : DAILY_RING_LIMIT;
}

export type RingResult = { ok: boolean; limitReached?: boolean };

/** Sends a Heart Alarm for a post, enforcing the 3-per-local-day limit. */
export async function ringPost(postId: string): Promise<RingResult> {
  const { error } = await (supabase as any).rpc("send_heart_alarm", {
    _post_id: postId,
    _local_date: localDate(),
  });
  if (error) {
    if (String(error.message ?? "").includes("DAILY_RING_LIMIT")) {
      return { ok: false, limitReached: true };
    }
    return { ok: false };
  }
  await (supabase as any).rpc("bump_ring_streak");
  // Fire-and-forget push so the receiver is alerted even outside the app.
  void import("@/lib/ifriend/push.functions")
    .then(({ notifyRing }) => notifyRing({ data: { postId } }))
    .catch(() => undefined);
  return { ok: true };
}

/** Marks a ring as handled so it never plays the full experience again. */
export async function acknowledgeRing(alarmId: string): Promise<void> {
  await (supabase as any).rpc("acknowledge_heart_alarm", { _alarm_id: alarmId });
}

/** Live count of rings remaining today (resets at local midnight). */
export function useRingsLeft() {
  const [left, setLeft] = useState<number>(DAILY_RING_LIMIT);
  const [day, setDay] = useState<string>(() => localDate());

  const refresh = useCallback(async () => {
    setLeft(await fetchRingsLeft());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, day]);

  // Roll over automatically at local midnight.
  useEffect(() => {
    const t = window.setInterval(() => {
      const now = localDate();
      setDay((d) => (d === now ? d : now));
    }, 60_000);
    return () => window.clearInterval(t);
  }, []);

  return { ringsLeft: left, refreshRings: refresh, setRingsLeft: setLeft };
}
