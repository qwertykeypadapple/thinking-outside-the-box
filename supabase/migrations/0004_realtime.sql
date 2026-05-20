-- Enable realtime broadcast on the chats table so the browser-side
-- SimilarStrip can refresh without polling.
-- Apply in Supabase Dashboard → SQL Editor.
--
-- RLS still applies to the realtime stream: subscribers only receive events
-- for rows they could SELECT. Our chats_public_read policy means clients
-- see public-chat changes — which is exactly the matching pool. Owner's
-- own-chat-while-unlisted changes don't deliver via realtime, but the
-- post-stream router.refresh() in chat-view handles that path.

do $$
begin
  begin
    alter publication supabase_realtime add table public.chats;
  exception
    when undefined_object then
      raise notice 'publication supabase_realtime not found; create it first';
    when duplicate_object then
      raise notice 'public.chats already in supabase_realtime; skipping';
  end;
end$$;
