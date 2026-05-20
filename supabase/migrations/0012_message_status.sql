-- Multi-viewer live streaming: every assistant turn is inserted as a
-- placeholder row at status='pending' when the LLM stream starts, then
-- UPDATEd to status='complete' with the final content when the stream
-- finishes. While pending, the server broadcasts each token on a Supabase
-- broadcast channel — other viewers of the same chat see live updates
-- without us touching the DB per token. The pending row also gives
-- tab-close resilience: reopening the chat shows "still being generated…"
-- instead of nothing.
-- Apply in Supabase Dashboard → SQL Editor.

alter table public.messages
  add column if not exists status text not null default 'complete'
  check (status in ('pending', 'complete'));

-- Pending rows are interesting to monitoring (orphans = stuck/aborted
-- streams). Partial index keeps it cheap.
create index if not exists messages_pending_idx
  on public.messages (chat_id, created_at)
  where status = 'pending';
