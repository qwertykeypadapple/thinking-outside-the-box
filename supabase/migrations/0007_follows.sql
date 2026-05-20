-- Follow graph: user→user follows and user→topic follows.
-- Apply in Supabase Dashboard → SQL Editor.

create table if not exists public.follows (
  follower_handle text not null,
  followee_handle text not null,
  created_at      timestamptz not null default now(),
  primary key (follower_handle, followee_handle),
  constraint follows_no_self check (follower_handle <> followee_handle)
);

create index if not exists follows_followee_idx on public.follows (followee_handle, created_at desc);
create index if not exists follows_follower_idx on public.follows (follower_handle, created_at desc);

alter table public.follows enable row level security;

drop policy if exists follows_public_read on public.follows;
create policy follows_public_read on public.follows for select using (true);
-- Writes via service role only.

create table if not exists public.topic_follows (
  handle      text not null,
  tag         text not null,
  created_at  timestamptz not null default now(),
  primary key (handle, tag),
  constraint topic_follows_tag_shape check (tag ~ '^[a-z0-9][a-z0-9-]{0,30}$')
);

create index if not exists topic_follows_tag_idx on public.topic_follows (tag);

alter table public.topic_follows enable row level security;
drop policy if exists topic_follows_public_read on public.topic_follows;
create policy topic_follows_public_read on public.topic_follows for select using (true);
