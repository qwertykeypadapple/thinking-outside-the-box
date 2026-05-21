-- Flip the default chat visibility from 'unlisted' to 'public'.
-- Apply in Supabase Dashboard → SQL Editor.
--
-- Rationale: the platform's pitch is "anonymously ask in public, see who's
-- wondering the same" — public-by-default is the discoverability path. The
-- in-app visibility picker still lets owners switch a chat to Unlisted
-- (link-only) at any point, so privacy remains a one-click choice for
-- anything that doesn't belong in the feed.
--
-- Note: this only affects the DB-level default. The app code in
-- src/lib/chat/store.ts also passes its own default when creating chats;
-- both are now 'public' for consistency.

alter table public.chats alter column visibility set default 'public';

-- Existing chats are left untouched: their visibility was an explicit
-- choice (or carried over from the earlier unlisted default) — flipping
-- them retroactively would surface content the owner didn't expect to be
-- public.
