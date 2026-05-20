// Browser client using the publishable key. Used for Realtime subscriptions
// (live feed, presence) per PLAN.md §4.1. Reads respect RLS public-read policies;
// writes are not made from the browser — they go through our Route Handlers.
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set");
  }
  return createBrowserClient(url, key);
}
