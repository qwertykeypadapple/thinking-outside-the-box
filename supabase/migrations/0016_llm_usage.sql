-- LLM usage tracking for the Anthropic spend kill-switch (PLAN §7.2).
-- One row per /api/chat call after the stream finishes. Used by the chat
-- route's pre-call gate to refuse new LLM calls once today's spend exceeds
-- LLM_DAILY_HARD_LIMIT_USD (default $25 — matches the PLAN.md target).
--
-- Local MLX calls also write rows but with usd_estimate = 0, so the table
-- reflects only real-dollar spend without special-casing the provider.
--
-- Apply in Supabase Dashboard → SQL Editor.

create table if not exists public.llm_usage (
  id              bigint generated always as identity primary key,
  model           text not null,
  input_tokens    int  not null check (input_tokens >= 0),
  output_tokens   int  not null check (output_tokens >= 0),
  usd_estimate    numeric(10, 6) not null default 0,
  created_at      timestamptz not null default now()
);

-- Daily-spend query window. The kill-switch sums usd_estimate WHERE
-- created_at >= date_trunc('day', now()) — the partial index on the
-- recent window keeps that scan cheap even at millions of rows.
create index if not exists llm_usage_created_idx
  on public.llm_usage (created_at desc);

-- Optional cleanup helper — run weekly to keep the table small. Old usage
-- data isn't useful for the kill-switch (only today matters) and historical
-- spend can be summarized in the /insights snapshot before deletion.
create or replace function public.llm_usage_cleanup_old()
returns int language plpgsql as $$
declare v_deleted int;
begin
  delete from public.llm_usage
  where created_at < now() - interval '30 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

alter table public.llm_usage enable row level security;
-- No policies — service role only. The /insights page reads via the admin
-- service-role client; the /api/chat route writes the same way.
