-- Perf: collapse "get this chat's embedding" + "match by embedding" into a
-- single Postgres round-trip. The page-load path calls match_for_chat(chatId)
-- and gets either nearest neighbors (when an embedding exists) or an empty
-- set (caller falls back to tag-overlap).
-- Apply in Supabase Dashboard → SQL Editor.

create or replace function public.match_for_chat(
  source_chat_id uuid,
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
  with src as (
    select owner_handle, summary_embedding
      from public.chats
     where id = source_chat_id
  )
  select
    c.id,
    c.owner_handle,
    c.topic_tags,
    c.last_active_at,
    (c.summary_embedding <=> (select summary_embedding from src))::float as distance
  from public.chats c, src
  where (select summary_embedding from src) is not null
    and c.visibility = 'public'
    and c.summary_embedding is not null
    and c.id <> source_chat_id
    and c.owner_handle <> src.owner_handle
    and c.last_active_at > now() - make_interval(mins => match_window_minutes)
  order by c.summary_embedding <=> (select summary_embedding from src)
  limit match_limit;
$$;
