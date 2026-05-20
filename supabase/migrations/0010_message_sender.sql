-- Multi-author chats: track who sent each user message so the UI can label
-- contributions when more than one person types into a chat. assistant rows
-- leave sender_handle null. Nullable on existing rows so the migration is
-- safe to apply without backfill; older messages render as "user" without a
-- handle, which matches their original single-author context.
-- Apply in Supabase Dashboard → SQL Editor.

alter table public.messages
  add column if not exists sender_handle text references public.users(handle) on delete set null;

create index if not exists messages_sender_handle_idx
  on public.messages (sender_handle)
  where sender_handle is not null;
