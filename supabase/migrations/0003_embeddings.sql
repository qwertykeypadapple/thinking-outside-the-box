-- Semantic matching: pgvector + summary_embedding column + HNSW index.
-- Apply in Supabase Dashboard → SQL Editor.
-- Model: Voyage AI voyage-3 → 1024-dim vectors. If we ever swap models with
-- different dims, we'll need a new column (vectors are dim-typed).

create extension if not exists vector;

alter table public.chats
  add column if not exists summary_embedding vector(1024);

-- HNSW is ideal for our scale (up to ~1M vectors) and supports filtering.
-- vector_cosine_ops because we'll use cosine distance (<=> operator).
create index if not exists chats_summary_embedding_hnsw
  on public.chats using hnsw (summary_embedding vector_cosine_ops);

-- RPC for nearest-neighbor search filtered to public + recent + non-self.
-- We expose this as a function because the JS client can't emit the <=>
-- operator directly. Returns top N by cosine distance.
create or replace function public.match_chats_by_embedding(
  query_embedding vector(1024),
  exclude_chat_id uuid,
  exclude_owner_handle text,
  match_window_minutes int default 1440,
  match_limit int default 20
)
returns table (
  id uuid,
  owner_handle text,
  topic_tags text[],
  last_active_at timestamptz,
  distance float
)
language sql stable
as $$
  select
    c.id,
    c.owner_handle,
    c.topic_tags,
    c.last_active_at,
    (c.summary_embedding <=> query_embedding)::float as distance
  from public.chats c
  where c.visibility = 'public'
    and c.summary_embedding is not null
    and c.id <> exclude_chat_id
    and c.owner_handle <> exclude_owner_handle
    and c.last_active_at > now() - make_interval(mins => match_window_minutes)
  order by c.summary_embedding <=> query_embedding
  limit match_limit;
$$;
