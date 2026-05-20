import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Cost discipline for the Anthropic spend kill-switch (PLAN §7.2).
//
// We track every LLM call's token usage + estimated USD cost. The chat route
// pre-checks today's spend before each call and refuses to issue a new one
// once the hard limit is hit. Soft limit is informational (logged on
// /insights, used for "we're close" UI). Both default to PLAN.md targets if
// the env vars aren't set.
//
// MLX calls go through the same pipeline but cost is $0 — they still record
// rows so we have a complete usage history, but they can't trip the gate.

// Per-million-token prices (USD). Update these if Anthropic changes pricing.
// Verify against https://www.anthropic.com/pricing before shipping.
const PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  "claude-sonnet-4-6":              { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  "claude-haiku-4-5-20251001":      { inputPerMillion: 0.8, outputPerMillion: 4.0 },
  // Local MLX is free.
  "mlx-community/Qwen3.5-9B-OptiQ-4bit": { inputPerMillion: 0, outputPerMillion: 0 },
};

// Char-based token estimate. Real Anthropic tokenization differs by ~10–20%
// depending on language and content; close enough for a $-gate that triggers
// at $15 / $25. We err on the conservative side (overestimate) by using a
// slightly tighter chars-per-token ratio than the literature suggests.
const CHARS_PER_TOKEN = 4;
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model];
  if (!p) return 0; // unknown model → assume free; conservative since we won't gate on unknowns
  return (
    (inputTokens * p.inputPerMillion) / 1_000_000 +
    (outputTokens * p.outputPerMillion) / 1_000_000
  );
}

// Fire-and-forget. Callers should `void recordUsage(...)` — usage tracking
// must never block the user-visible response, and a failure here (e.g. table
// not yet migrated in prod) is a silently-dropped row, not a chat error.
export async function recordUsage(args: {
  model: string;
  inputText: string;
  outputText: string;
}): Promise<void> {
  const inputTokens = estimateTokens(args.inputText);
  const outputTokens = estimateTokens(args.outputText);
  const usd = estimateUsd(args.model, inputTokens, outputTokens);

  try {
    await getSupabaseAdmin().from("llm_usage").insert({
      model: args.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      usd_estimate: usd,
    });
  } catch {
    // Swallow — losing one usage row is fine; blocking a stream is not.
  }
}

// Returns today's accumulated USD spend (since UTC midnight). Errors return
// 0 so a Supabase outage doesn't accidentally trigger the kill-switch.
export async function getDailySpendUsd(): Promise<number> {
  try {
    const sinceIso = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString();
    const { data, error } = await getSupabaseAdmin()
      .from("llm_usage")
      .select("usd_estimate")
      .gte("created_at", sinceIso);
    if (error) return 0;
    return ((data ?? []) as { usd_estimate: number | string }[]).reduce(
      (sum, r) => sum + Number(r.usd_estimate ?? 0),
      0,
    );
  } catch {
    return 0;
  }
}

// Thresholds from PLAN §7.2. Soft = alert/warn; hard = refuse new calls.
// Both overridable via env so dev/CI can bump them out of the way.
export function getSoftLimitUsd(): number {
  const raw = Number(process.env.LLM_DAILY_SOFT_LIMIT_USD ?? "15");
  return Number.isFinite(raw) ? raw : 15;
}

export function getHardLimitUsd(): number {
  const raw = Number(process.env.LLM_DAILY_HARD_LIMIT_USD ?? "25");
  return Number.isFinite(raw) ? raw : 25;
}

// Pre-call gate. The chat route invokes this once per request — if true, no
// LLM call should be made and the route should return 429.
export async function isOverHardLimit(): Promise<boolean> {
  if (process.env.LLM_KILLSWITCH_DISABLED === "1") return false;
  return (await getDailySpendUsd()) >= getHardLimitUsd();
}
