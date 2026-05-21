import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Relaxed limits — established handles can chat freely; fresh handles
// (< 24h since created_at) stay proportionally tighter to slow throwaway-
// handle abuse. Sponsors get 2× later (when we wire that up).
const LIMITS = {
  fresh:       { hour: 100, day: 200 },
  established: { hour: 500, day: 1000 },
};

const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

export type RateLimitDecision =
  | { ok: true }
  | { ok: false; bucket: "hour" | "day"; limit: number; resetInSec: number };

export async function checkAndIncrement(
  handle: string,
  createdAt: Date | string | null,
): Promise<RateLimitDecision> {
  const created = createdAt ? new Date(createdAt).getTime() : Date.now();
  const isFresh = Date.now() - created < FRESH_WINDOW_MS;
  const lim = isFresh ? LIMITS.fresh : LIMITS.established;

  const sb = getSupabaseAdmin();
  const [hr, dy] = await Promise.all([
    sb.rpc("rate_limit_increment", { p_handle: handle, p_bucket: "hour", p_truncate_to: "hour" }),
    sb.rpc("rate_limit_increment", { p_handle: handle, p_bucket: "day",  p_truncate_to: "day"  }),
  ]);
  if (hr.error) throw new Error(`rate_limit hour: ${hr.error.message}`);
  if (dy.error) throw new Error(`rate_limit day: ${dy.error.message}`);

  const hCount = hr.data as number;
  const dCount = dy.data as number;

  if (hCount > lim.hour) {
    return { ok: false, bucket: "hour", limit: lim.hour, resetInSec: secondsUntilNextBoundary("hour") };
  }
  if (dCount > lim.day) {
    return { ok: false, bucket: "day", limit: lim.day, resetInSec: secondsUntilNextBoundary("day") };
  }
  return { ok: true };
}

function secondsUntilNextBoundary(bucket: "hour" | "day"): number {
  const now = new Date();
  const next = new Date(now);
  if (bucket === "hour") {
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
  } else {
    next.setHours(0, 0, 0, 0);
    next.setDate(next.getDate() + 1);
  }
  return Math.ceil((next.getTime() - now.getTime()) / 1000);
}
