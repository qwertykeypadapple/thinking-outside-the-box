-- Remove the "private" visibility option from the product.
-- Apply in Supabase Dashboard → SQL Editor.
--
-- Rationale: the platform's pitch is "think in public." A private mode
-- conflicts with the core loop and confused the visibility toggle UX.
-- Anything that doesn't belong in the public feed can be "unlisted" —
-- still link-shareable, just not surfaced.

-- Existing private chats become unlisted (still only reachable via direct link).
update public.chats set visibility = 'unlisted' where visibility = 'private';

-- New chats default to unlisted.
alter table public.chats alter column visibility set default 'unlisted';

-- Constraint still allows 'private' as a value (backwards-compat); the app
-- no longer writes it. If we want to harden later, drop and re-add the check.
