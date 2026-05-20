-- Per-handle rate limits keyed on (handle, bucket, window_start) where
-- window_start = date_trunc('hour' | 'day', now()). Atomic increment via RPC.
-- Apply in Supabase Dashboard → SQL Editor.

create table if not exists public.rate_limits (
  handle        text not null,
  bucket        text not null check (bucket in ('hour', 'day')),
  window_start  timestamptz not null,
  count         int not null default 0,
  primary key (handle, bucket, window_start)
);

create index if not exists rate_limits_cleanup_idx
  on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
-- No policies — server-only via service role.

create or replace function public.rate_limit_increment(
  p_handle      text,
  p_bucket      text,
  p_truncate_to text
) returns int
language plpgsql
as $$
declare
  v_window_start timestamptz := date_trunc(p_truncate_to, now());
  v_count int;
begin
  insert into public.rate_limits (handle, bucket, window_start, count)
  values (p_handle, p_bucket, v_window_start, 1)
  on conflict (handle, bucket, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into v_count;
  return v_count;
end;
$$;

-- Optional cleanup helper — run periodically to keep the table small.
create or replace function public.rate_limits_cleanup_old()
returns int language plpgsql as $$
declare v_deleted int;
begin
  delete from public.rate_limits
  where window_start < now() - interval '2 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
