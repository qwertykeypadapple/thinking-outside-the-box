-- Lightweight in-house analytics (Wave 5).
-- One row per action: page_view, chat_started, message_sent, chat_made_public,
-- follow, unfollow, search, report_filed. Used by /insights to answer:
--   - Are people coming back? (distinct handle per day)
--   - Where do they drop off? (page_view → message_sent → made_public funnel)
--   - What features get used? (event counts per type per window)
--
-- Stores NO message content, NO IP, NO UA — just type, handle (already
-- device-scoped, no PII), tiny props blob, and the timestamp.
-- Apply in Supabase Dashboard → SQL Editor.

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  type        text not null check (char_length(type) between 1 and 64),
  handle      text,    -- intentionally loose: keep events even if the user row
                       -- is later deleted; no FK so insert is one statement.
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Type-windowed scans: "how many message_sent in the last 24h?"
create index if not exists events_type_created_idx
  on public.events (type, created_at desc);

-- DAU/WAU/MAU: distinct handle per window. Partial keeps null-handle rows
-- (e.g. anonymous page_view before cookie is minted) out of the index since
-- they can't contribute to a distinct-handle count anyway.
create index if not exists events_handle_created_idx
  on public.events (handle, created_at desc)
  where handle is not null;

-- Recent-events spot-check view on /insights.
create index if not exists events_created_idx
  on public.events (created_at desc);

alter table public.events enable row level security;
-- No anonymous read policy — /insights uses the service role like /reports.
-- (Service role bypasses RLS.)
