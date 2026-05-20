-- Abuse reports. Anyone can file; you review in /reports (admin handle gated)
-- or directly in Supabase. Apply in Supabase Dashboard → SQL Editor.

create table if not exists public.reports (
  id                uuid primary key default gen_random_uuid(),
  chat_id           uuid not null references public.chats(id) on delete cascade,
  reporter_handle   text,
  reason            text not null check (char_length(reason) between 1 and 500),
  status            text not null default 'open'
                      check (status in ('open', 'resolved', 'dismissed')),
  -- Filled in by the moderation classifier later (Haiku in prod, Qwen locally).
  auto_category     text,
  auto_confidence   float,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_chat_id_idx on public.reports (chat_id);

alter table public.reports enable row level security;
-- No anonymous read — admin handle access via service role on the server.
-- (No policies defined intentionally; service role bypasses RLS.)
