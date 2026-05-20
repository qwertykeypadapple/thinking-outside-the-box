-- Self-service data erasure (right-to-be-forgotten flow). PLAN §8.4 commits
-- to a strict privacy posture; this is how a user actually gets out.
--
-- Default policy: ghost-user. Profile, owned chats (cascading their
-- messages), follow graph, tag follows, filed reports, and analytics events
-- all go. Messages the user typed in OTHER people's chats stay — but
-- sender_handle gets set to NULL via the existing FK cascade (migration
-- 0010 declared messages.sender_handle references users(handle) ON DELETE
-- SET NULL). This preserves chat coherence for other owners while erasing
-- the user's identity.
--
-- Scorched-earth (p_scorched = true): also deletes the messages they
-- contributed to others' chats. Leaves visible gaps in those threads.
-- Not exposed in the UI yet — added now so flipping the checkbox later is
-- a one-line change in the action layer.
--
-- Apply in Supabase Dashboard → SQL Editor.

create or replace function public.delete_user_data(
  p_handle    text,
  p_scorched  boolean default false
)
returns void
language plpgsql
security definer
as $$
begin
  -- Idempotent: if the user is already gone (e.g. concurrent delete-me
  -- requests or a retry after a failed transaction), just return.
  if not exists (select 1 from public.users where handle = p_handle) then
    return;
  end if;

  -- Scorched path: delete the user's contributions in OTHER people's chats
  -- BEFORE deleting the user row. Otherwise the FK cascade (SET NULL) would
  -- anonymize them first and we'd have no way to identify them.
  -- Messages in the user's OWN chats are handled by the chats DELETE below
  -- via the chat_id FK cascade — no need to touch them here.
  if p_scorched then
    delete from public.messages
    where sender_handle = p_handle
      and chat_id not in (
        select id from public.chats where owner_handle = p_handle
      );
  end if;

  -- Owned chats. Cascades to all messages in those chats via the chat_id
  -- FK from migration 0001. Auto-reports tied to those messages have their
  -- message_id set to NULL via the FK from migration 0013 — the report
  -- rows themselves stay for admin review.
  delete from public.chats where owner_handle = p_handle;

  -- Follow graph in both directions.
  delete from public.follows
  where follower_handle = p_handle or followee_handle = p_handle;

  -- Tag follows.
  delete from public.topic_follows where handle = p_handle;

  -- Reports the user filed against others. Auto-reports the user triggered
  -- (where reporter_handle is NULL but message_id pointed to their message)
  -- stay; their message_id was nulled when the owning chat was deleted above.
  delete from public.reports where reporter_handle = p_handle;

  -- Analytics events.
  delete from public.events where handle = p_handle;

  -- Finally the user row. For ghost-user mode, the FK cascade on
  -- messages.sender_handle sets it to NULL for any remaining messages
  -- (which are now all in others' chats, since the user's owned chats
  -- and their messages are already gone).
  delete from public.users where handle = p_handle;
end;
$$;

revoke all on function public.delete_user_data(text, boolean) from public, anon, authenticated;
