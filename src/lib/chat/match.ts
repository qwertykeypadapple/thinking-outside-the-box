import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type Match = {
  id: string;
  owner_handle: string;
  shared_tags: string[];
  topic_tags: string[];
  last_active_at: string;
  // Cosine distance when matched via embeddings (0 = identical, 2 = opposite).
  // null when matched via tag-overlap only.
  distance?: number | null;
};

const MATCH_WINDOW_MS = 24 * 60 * 60 * 1000;
const MATCH_WINDOW_MINUTES = 24 * 60;
const FETCH_OVERFETCH = 30; // pull a wider candidate pool, rank in app
// Cosine distance cutoff. <=0.4 is "actually similar" for voyage-3.
const SEMANTIC_DISTANCE_MAX = 0.45;

// Wave-2 matching: cheap tag-overlap, last 24h of public chats.
// Embedding-based semantic match comes in the next slice — same interface.
export async function findSimilarChats(
  chatId: string,
  ownerHandle: string,
  tags: string[],
  limit = 5,
): Promise<Match[]> {
  if (tags.length === 0) return [];

  const since = new Date(Date.now() - MATCH_WINDOW_MS).toISOString();

  const { data, error } = await getSupabaseAdmin()
    .from("chats")
    .select("id, owner_handle, last_active_at, topic_tags")
    .eq("visibility", "public")
    .neq("owner_handle", ownerHandle)
    .neq("id", chatId)
    .gte("last_active_at", since)
    .overlaps("topic_tags", tags)
    .order("last_active_at", { ascending: false })
    .limit(FETCH_OVERFETCH);

  if (error) throw new Error(`findSimilarChats: ${error.message}`);

  type Row = {
    id: string;
    owner_handle: string;
    last_active_at: string;
    topic_tags: string[] | null;
  };

  const currentSet = new Set(tags);

  return ((data ?? []) as Row[])
    .map<Match>((c) => {
      const other = c.topic_tags ?? [];
      const shared = other.filter((t) => currentSet.has(t));
      return {
        id: c.id,
        owner_handle: c.owner_handle,
        topic_tags: other,
        shared_tags: shared,
        last_active_at: c.last_active_at,
      };
    })
    .filter((m) => m.shared_tags.length > 0)
    .sort((a, b) => {
      if (b.shared_tags.length !== a.shared_tags.length) {
        return b.shared_tags.length - a.shared_tags.length;
      }
      return b.last_active_at.localeCompare(a.last_active_at);
    })
    .slice(0, limit);
}

// Semantic match using pgvector's cosine distance, surfaced via an RPC defined
// in migration 0003. Catches conceptual similarity even without shared tags.
export async function findSimilarChatsByEmbedding(
  chatId: string,
  ownerHandle: string,
  embedding: number[],
  currentTags: string[],
  limit = 5,
): Promise<Match[]> {
  if (embedding.length === 0) return [];

  const { data, error } = await getSupabaseAdmin().rpc("match_chats_by_embedding", {
    query_embedding: embedding,
    exclude_chat_id: chatId,
    exclude_owner_handle: ownerHandle,
    match_window_minutes: MATCH_WINDOW_MINUTES,
    match_limit: FETCH_OVERFETCH,
  });

  if (error) throw new Error(`findSimilarChatsByEmbedding: ${error.message}`);

  type Row = {
    id: string;
    owner_handle: string;
    topic_tags: string[] | null;
    last_active_at: string;
    distance: number;
  };

  const currentSet = new Set(currentTags);
  return ((data ?? []) as Row[])
    .filter((r) => r.distance <= SEMANTIC_DISTANCE_MAX)
    .map<Match>((r) => {
      const other = r.topic_tags ?? [];
      return {
        id: r.id,
        owner_handle: r.owner_handle,
        topic_tags: other,
        shared_tags: other.filter((t) => currentSet.has(t)),
        last_active_at: r.last_active_at,
        distance: r.distance,
      };
    })
    .slice(0, limit);
}

// Perf-tuned wrapper: collapses "look up the source chat's embedding" + "find
// similar chats" into one Postgres round-trip via the match_for_chat RPC
// (migration 0011). Halves the chat-page tail-latency on a warm DB. Returns
// an empty array if the chat has no embedding yet — caller falls back to
// tag-overlap.
export async function findSimilarChatsForChat(
  chatId: string,
  currentTags: string[],
  limit = 5,
): Promise<Match[]> {
  const { data, error } = await getSupabaseAdmin().rpc("match_for_chat", {
    source_chat_id: chatId,
    match_window_minutes: MATCH_WINDOW_MINUTES,
    match_limit: FETCH_OVERFETCH,
  });
  // Gracefully degrade if the RPC isn't deployed yet — the caller still has
  // the two-call path to fall back to.
  if (error) return [];

  type Row = {
    id: string;
    owner_handle: string;
    topic_tags: string[] | null;
    last_active_at: string;
    distance: number;
  };

  const currentSet = new Set(currentTags);
  return ((data ?? []) as Row[])
    .filter((r) => r.distance <= SEMANTIC_DISTANCE_MAX)
    .map<Match>((r) => {
      const other = r.topic_tags ?? [];
      return {
        id: r.id,
        owner_handle: r.owner_handle,
        topic_tags: other,
        shared_tags: other.filter((t) => currentSet.has(t)),
        last_active_at: r.last_active_at,
        distance: r.distance,
      };
    })
    .slice(0, limit);
}
