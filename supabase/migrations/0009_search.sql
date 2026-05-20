-- Full-text search index on message content + semantic-search RPC on chats.
-- Apply in Supabase Dashboard → SQL Editor.

alter table public.messages
  add column if not exists search_vec tsvector
  generated always as (to_tsvector('english', content_redacted)) stored;

create index if not exists messages_search_vec_idx on public.messages using gin (search_vec);

-- Keyword search over messages, returning distinct chats with at least one
-- matching message. Restricted to public chats.
create or replace function public.search_chats_by_keyword(
  q text,
  match_limit int default 20
) returns table (
  id uuid,
  owner_handle text,
  topic_tags text[],
  last_active_at timestamptz,
  hit_excerpt text
)
language sql stable
as $$
  with hits as (
    select
      m.chat_id,
      ts_headline('english', m.content_redacted, websearch_to_tsquery('english', q),
        'MaxFragments=1,MinWords=4,MaxWords=18,StartSel=«,StopSel=»') as excerpt,
      ts_rank(m.search_vec, websearch_to_tsquery('english', q)) as rank
    from public.messages m
    where m.search_vec @@ websearch_to_tsquery('english', q)
  ),
  ranked as (
    select chat_id, max(rank) as rank, (array_agg(excerpt order by rank desc))[1] as excerpt
    from hits group by chat_id
  )
  select c.id, c.owner_handle, c.topic_tags, c.last_active_at, r.excerpt
  from ranked r
  join public.chats c on c.id = r.chat_id
  where c.visibility = 'public'
  order by r.rank desc, c.last_active_at desc
  limit match_limit;
$$;

-- Semantic search over public chats by query-embedding cosine distance.
create or replace function public.search_chats_by_embedding(
  query_embedding vector(1024),
  match_limit int default 20
) returns table (
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
  where c.visibility = 'public' and c.summary_embedding is not null
  order by c.summary_embedding <=> query_embedding
  limit match_limit;
$$;
