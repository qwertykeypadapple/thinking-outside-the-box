-- Profiles: one row per handle. Created on first visit (via proxy upsert).
-- Apply in Supabase Dashboard → SQL Editor.
--
-- No emails, no real names. Bio is opt-in user content; everything else is
-- platform-generated. Aligns with PLAN.md "no PII columns by design."

create table if not exists public.users (
  handle        text primary key,
  bio           text not null default '',
  avatar_url    text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  constraint users_bio_length check (char_length(bio) <= 280),
  constraint users_handle_shape check (handle ~ '^[a-z][a-z0-9-]{2,30}$')
);

create index if not exists users_last_seen_idx on public.users (last_seen_at desc);

alter table public.users enable row level security;

drop policy if exists users_public_read on public.users;
create policy users_public_read
  on public.users for select
  using (true);

-- Note: no insert/update/delete policies for anonymous clients.
-- All writes go through the Next.js server using SUPABASE_SECRET_KEY.

-- Backfill: create user rows for every existing chat owner_handle.
insert into public.users (handle)
select distinct owner_handle from public.chats
on conflict (handle) do nothing;
