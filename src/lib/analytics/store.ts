import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Closed taxonomy. The /insights page assumes every event type is one of
// these — keeping the set tight stops drift and makes the funnel queries
// predictable. Add new types here and in MIGRATION 0014's documentation.
export const EVENT_TYPES = [
  "page_view",
  "chat_started",
  "message_sent",
  "chat_made_public",
  "chat_made_unlisted",
  "follow",
  "unfollow",
  "tag_follow",
  "tag_unfollow",
  "search",
  "report_filed",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type EventRecord = {
  id: number;
  type: EventType;
  handle: string | null;
  props: Record<string, unknown>;
  created_at: string;
};

// Fire-and-forget event recording. Callers should `void recordEvent(...)` —
// analytics writes must never block a user-facing flow, and a failure here
// is a quietly-dropped row, not a user-visible error. ANALYTICS_DISABLED=1
// turns the whole pipeline off for tests / cost cuts.
export async function recordEvent(
  type: EventType,
  handle: string | null,
  props: Record<string, unknown> = {},
): Promise<void> {
  if (process.env.ANALYTICS_DISABLED === "1") return;
  try {
    await getSupabaseAdmin()
      .from("events")
      .insert({ type, handle, props });
  } catch {
    // Swallow — losing one row is fine; blocking a user flow is not.
  }
}

// ---------- Aggregations for /insights ----------

// Distinct-handle count for a rolling window. Used for DAU/WAU/MAU.
export async function distinctHandleCount(sinceIso: string): Promise<number> {
  const sb = getSupabaseAdmin();
  // Supabase JS doesn't expose count-distinct directly. Pull the candidate
  // handles for the window (capped at 50k so a runaway DAU doesn't blow up
  // the page) and uniq client-side. At our scale this is fine; once the
  // platform grows we'd push this into an RPC.
  const { data, error } = await sb
    .from("events")
    .select("handle")
    .gte("created_at", sinceIso)
    .not("handle", "is", null)
    .limit(50_000);
  if (error) throw new Error(`distinctHandleCount: ${error.message}`);
  const set = new Set<string>();
  for (const row of (data ?? []) as { handle: string | null }[]) {
    if (row.handle) set.add(row.handle);
  }
  return set.size;
}

export async function eventCount(
  type: EventType,
  sinceIso: string,
): Promise<number> {
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("type", type)
    .gte("created_at", sinceIso);
  if (error) throw new Error(`eventCount[${type}]: ${error.message}`);
  return count ?? 0;
}

// New handles (rows in users) created since the cutoff. The users table is
// the source of truth for "first-seen"; events.handle would over-count
// because it skips legacy users with no recent activity.
export async function newHandleCount(sinceIso: string): Promise<number> {
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from("users")
    .select("handle", { count: "exact", head: true })
    .gte("created_at", sinceIso);
  if (error) throw new Error(`newHandleCount: ${error.message}`);
  return count ?? 0;
}

// Most-used topic tags this week — pulled from chats.topic_tags directly
// because tags already aggregate intent better than an event stream would.
export async function topTags(
  sinceIso: string,
  limit = 10,
): Promise<{ tag: string; count: number }[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("chats")
    .select("topic_tags")
    .eq("visibility", "public")
    .gte("last_active_at", sinceIso)
    .limit(2_000);
  if (error) throw new Error(`topTags: ${error.message}`);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { topic_tags: string[] | null }[]) {
    for (const t of row.topic_tags ?? []) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

export async function recentEvents(limit = 50): Promise<EventRecord[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("events")
    .select("id, type, handle, props, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`recentEvents: ${error.message}`);
  return (data ?? []) as EventRecord[];
}
