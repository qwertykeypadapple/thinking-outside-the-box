import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getEmbeddingProvider } from "@/lib/embeddings";

export type SearchHit = {
  id: string;
  owner_handle: string;
  topic_tags: string[];
  last_active_at: string;
  excerpt: string | null;
  distance: number | null;
};

export async function keywordSearch(query: string, limit = 20): Promise<SearchHit[]> {
  if (!query.trim()) return [];
  const { data, error } = await getSupabaseAdmin().rpc("search_chats_by_keyword", {
    q: query.trim(),
    match_limit: limit,
  });
  if (error) throw new Error(`keywordSearch: ${error.message}`);
  type Row = {
    id: string;
    owner_handle: string;
    topic_tags: string[] | null;
    last_active_at: string;
    hit_excerpt: string | null;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    owner_handle: r.owner_handle,
    topic_tags: r.topic_tags ?? [],
    last_active_at: r.last_active_at,
    excerpt: r.hit_excerpt,
    distance: null,
  }));
}

export async function semanticSearch(query: string, limit = 20): Promise<SearchHit[]> {
  const provider = getEmbeddingProvider();
  if (!provider || !query.trim()) return [];

  const vec = await provider.embed(query.trim(), { kind: "query" });
  const { data, error } = await getSupabaseAdmin().rpc("search_chats_by_embedding", {
    query_embedding: vec,
    match_limit: limit,
  });
  if (error) throw new Error(`semanticSearch: ${error.message}`);
  type Row = {
    id: string;
    owner_handle: string;
    topic_tags: string[] | null;
    last_active_at: string;
    distance: number;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    owner_handle: r.owner_handle,
    topic_tags: r.topic_tags ?? [],
    last_active_at: r.last_active_at,
    excerpt: null,
    distance: r.distance,
  }));
}
