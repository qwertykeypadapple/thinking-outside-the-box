-- Wave 1.5 schema: chats + messages.
-- Apply in Supabase Dashboard → SQL Editor.
-- pgvector / embeddings / users / follows come in later waves (see PLAN.md §4.5).

-- =============================================================
-- chats: one row per conversation
-- =============================================================
create table if not exists public.chats (
  id              uuid primary key default gen_random_uuid(),
  owner_handle    text not null,
  visibility      text not null default 'private'
                    check (visibility in ('public', 'unlisted', 'private')),
  topic_tags      text[] not null default '{}',
  summary         text,
  created_at      timestamptz not null default now(),
  last_active_at  timestamptz not null default now()
);

create index if not exists chats_owner_handle_idx on public.chats (owner_handle);
create index if not exists chats_last_active_idx  on public.chats (last_active_at desc);
create index if not exists chats_public_recent_idx
  on public.chats (last_active_at desc) where visibility = 'public';

-- =============================================================
-- messages: ordered turns within a chat (PII-redacted before insert)
-- =============================================================
create table if not exists public.messages (
  id                uuid primary key default gen_random_uuid(),
  chat_id           uuid not null references public.chats(id) on delete cascade,
  role              text not null check (role in ('user', 'assistant', 'system')),
  content_redacted  text not null,
  created_at        timestamptz not null default now()
);

create index if not exists messages_chat_id_idx on public.messages (chat_id, created_at);

-- =============================================================
-- last_active_at bookkeeping
-- =============================================================
create or replace function public.touch_chat_last_active()
returns trigger as $$
begin
  update public.chats
    set last_active_at = now()
    where id = new.chat_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists messages_touch_chat on public.messages;
create trigger messages_touch_chat
  after insert on public.messages
  for each row execute function public.touch_chat_last_active();

-- =============================================================
-- Row Level Security
-- Service-role server writes bypass RLS; browser reads must pass policies.
-- =============================================================
alter table public.chats     enable row level security;
alter table public.messages  enable row level security;

drop policy if exists chats_public_read on public.chats;
create policy chats_public_read
  on public.chats for select
  using (visibility = 'public');

drop policy if exists messages_public_read on public.messages;
create policy messages_public_read
  on public.messages for select
  using (
    exists (
      select 1 from public.chats c
       where c.id = messages.chat_id
         and c.visibility = 'public'
    )
  );

-- Note: no insert/update/delete policies for anonymous clients.
-- All writes go through the Next.js server using SUPABASE_SECRET_KEY.
