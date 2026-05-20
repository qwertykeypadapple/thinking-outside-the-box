// Service-role client. Bypasses RLS — only use server-side, never expose to the browser.
// All writes (chats, messages, follows) and owner-scoped reads go through this client
// because we use signed-cookie identity (PLAN.md §4.2), not Supabase Auth, so RLS has
// no auth.uid() to key off of.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL must be set");
  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY must be set. Get it from Supabase Dashboard → Project Settings → API Keys → secret key.",
    );
  }
  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
