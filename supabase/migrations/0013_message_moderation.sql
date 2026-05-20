-- Per-message moderation classifier output (Wave 5).
-- A Haiku 4.5 pass (or local Qwen in dev) classifies each user + assistant
-- message into one of a small taxonomy ('safe', 'harassment', 'hate', etc.).
-- Findings ≥ threshold also fan out to public.reports as auto-filed reports
-- via createAutoReport() — this column is the per-message audit trail so we
-- can review without re-running the classifier.
-- Apply in Supabase Dashboard → SQL Editor.

alter table public.messages
  add column if not exists moderation_category text,
  add column if not exists moderation_confidence float;

-- Cheap lookup for "show me unsafe content per chat" in the admin queue.
-- Partial: 'safe' and null rows (the overwhelming majority) stay out of the
-- index, keeping it tiny even at scale.
create index if not exists messages_moderation_flagged_idx
  on public.messages (chat_id, created_at desc)
  where moderation_category is not null and moderation_category <> 'safe';

-- Reports already carry auto_category/auto_confidence (migration 0008).
-- Add a back-reference to the message that triggered the auto-report so the
-- admin queue can deep-link straight to the offending turn. Nullable: human
-- reports don't fill it in, and dedup may attach a later finding to an earlier
-- report.
alter table public.reports
  add column if not exists message_id uuid references public.messages(id) on delete set null;

create index if not exists reports_message_id_idx
  on public.reports (message_id)
  where message_id is not null;
