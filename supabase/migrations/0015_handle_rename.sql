-- One-time custom handle rename (PLAN §2.1: "pick a custom handle, one-time,
-- must be unique"). The auto-generated `curious-otter-42`-style handle is the
-- starting identity; users may change it to something custom once, after which
-- renamed_at is set and the rename UI hides.
--
-- handle is the primary key of users and shows up as a plain text column in
-- chats, messages, follows, topic_follows, reports, and events. None of those
-- have ON UPDATE CASCADE, so the rename function updates each table in one
-- transaction. Locks the user row first to make concurrent renames serialize.
--
-- Apply in Supabase Dashboard → SQL Editor.

alter table public.users
  add column if not exists renamed_at timestamptz;

create or replace function public.rename_handle(
  p_old_handle text,
  p_new_handle text
)
returns void
language plpgsql
security definer
as $$
declare
  v_already_renamed timestamptz;
begin
  -- Shape check (mirror users_handle_shape from migration 0005).
  if p_new_handle !~ '^[a-z][a-z0-9-]{2,30}$' then
    raise exception 'invalid handle shape: %', p_new_handle
      using errcode = '22023';  -- invalid_parameter_value
  end if;

  if p_old_handle = p_new_handle then
    raise exception 'new handle matches existing handle'
      using errcode = '22023';
  end if;

  -- Lock the source row so concurrent renames serialize. Also confirms the
  -- old handle exists.
  select renamed_at into v_already_renamed
    from public.users
    where handle = p_old_handle
    for update;

  if not found then
    raise exception 'source handle does not exist: %', p_old_handle
      using errcode = 'P0002';  -- no_data_found
  end if;

  if v_already_renamed is not null then
    raise exception 'handle has already been renamed (at %)', v_already_renamed
      using errcode = '23514';  -- check_violation; semantically "already done"
  end if;

  -- Reject if the target is taken. Lower-case + shape are enforced by the
  -- users_handle_shape check constraint, but uniqueness check is explicit.
  if exists (select 1 from public.users where handle = p_new_handle) then
    raise exception 'handle already taken: %', p_new_handle
      using errcode = '23505';  -- unique_violation
  end if;

  -- Insert the new row first so the FK from messages.sender_handle has a
  -- target when we flip those rows over. We re-INSERT rather than UPDATE
  -- because users.handle is a primary key referenced by other FKs; updating
  -- a PK while FKs point at it is a recipe for "violates foreign key" mid-
  -- transaction. Copy the profile fields explicitly.
  insert into public.users (handle, bio, avatar_url, created_at, last_seen_at, renamed_at)
  select p_new_handle, bio, avatar_url, created_at, last_seen_at, now()
    from public.users
    where handle = p_old_handle;

  -- Move every handle-bearing row over. Plain UPDATEs — none of these have FK
  -- declarations that would block. Order doesn't matter; all rows referencing
  -- the old handle simply move.
  update public.chats set owner_handle = p_new_handle where owner_handle = p_old_handle;
  update public.messages set sender_handle = p_new_handle where sender_handle = p_old_handle;
  update public.follows set follower_handle = p_new_handle where follower_handle = p_old_handle;
  update public.follows set followee_handle = p_new_handle where followee_handle = p_old_handle;
  update public.topic_follows set handle = p_new_handle where handle = p_old_handle;
  update public.reports set reporter_handle = p_new_handle where reporter_handle = p_old_handle;
  update public.events set handle = p_new_handle where handle = p_old_handle;

  -- Old row is now orphaned — drop it.
  delete from public.users where handle = p_old_handle;
end;
$$;

-- Service role bypasses RLS so the function definer doesn't strictly need to
-- be elevated, but `security definer` future-proofs against any policy that
-- would otherwise block the multi-table writes.
revoke all on function public.rename_handle(text, text) from public, anon, authenticated;
