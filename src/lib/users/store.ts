import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { PublicChatPreview } from "@/lib/chat/store";
import type { ChatMessage } from "@/lib/llm";

export type UserRecord = {
  handle: string;
  bio: string;
  avatar_url: string | null;
  created_at: string;
  last_seen_at: string;
};

export async function getUser(handle: string): Promise<UserRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .select("*")
    .eq("handle", handle)
    .maybeSingle();
  if (error) throw new Error(`getUser: ${error.message}`);
  return (data as UserRecord) ?? null;
}

// Idempotent. Called from the proxy on first visit and (cheaply) again on
// each chat write to keep last_seen_at fresh.
export async function upsertUser(handle: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("users")
    .upsert({ handle, last_seen_at: new Date().toISOString() }, { onConflict: "handle" });
  if (error) throw new Error(`upsertUser: ${error.message}`);
}

export async function updateBio(handle: string, bio: string): Promise<void> {
  const trimmed = bio.trim().slice(0, 280);
  const { error } = await getSupabaseAdmin()
    .from("users")
    .update({ bio: trimmed })
    .eq("handle", handle);
  if (error) throw new Error(`updateBio: ${error.message}`);
}

export async function touchLastSeen(handle: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("handle", handle);
  if (error) throw new Error(`touchLastSeen: ${error.message}`);
}

// Self-service data erasure. Delegates the cascading deletes to the
// delete_user_data() Postgres function (migration 0017) so everything
// happens in one transaction — no chance of partial state if the request
// dies mid-flight.
//
// scorched=false (default, "ghost-user"): erase profile, owned chats,
// follows, reports filed, events, and the user row. Messages the user
// typed in OTHER people's chats stay but get sender_handle = NULL via
// FK cascade. Preserves chat coherence for other owners.
//
// scorched=true: also delete those messages. Not exposed in UI yet; the
// flag is here so the future "delete my messages everywhere" checkbox is
// a one-line passthrough.
export async function deleteUserData(
  handle: string,
  scorched: boolean = false,
): Promise<void> {
  const { error } = await getSupabaseAdmin().rpc("delete_user_data", {
    p_handle: handle,
    p_scorched: scorched,
  });
  if (error) throw new Error(`deleteUserData: ${error.message}`);
}

export type ProfileSummary = {
  user: UserRecord;
  total_public_chats: number;
  top_tags: Array<{ tag: string; count: number }>;
  recent_chats: PublicChatPreview[];
};

type ChatWithMessagesRow = {
  id: string;
  owner_handle: string;
  last_active_at: string;
  topic_tags: string[] | null;
  messages: {
    role: string;
    content_redacted: string;
    created_at: string;
    status?: string;
  }[];
};

export async function getProfileSummary(handle: string): Promise<ProfileSummary | null> {
  // Run user lookup + chats query in parallel. Roughly halves the wall-time
  // on the profile page — both go to the same Postgres so the round-trip
  // latency dominates and serial calls double it for no reason.
  const sb = getSupabaseAdmin();
  const [user, chatsResult] = await Promise.all([
    getUser(handle),
    sb
      .from("chats")
      .select("id, owner_handle, last_active_at, topic_tags, messages(role, content_redacted, created_at, status)")
      .eq("owner_handle", handle)
      .eq("visibility", "public")
      .order("last_active_at", { ascending: false })
      .limit(20),
  ]);
  if (!user) return null;
  if (chatsResult.error) throw new Error(`getProfileSummary: ${chatsResult.error.message}`);

  const rows = (chatsResult.data ?? []) as ChatWithMessagesRow[];
  const tagCounts = new Map<string, number>();

  const recent_chats: PublicChatPreview[] = rows.map((c) => {
    const sorted = c.messages
      .filter((m) => (m.status ?? "complete") === "complete")
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const firstUser = sorted.find((m) => m.role === "user");
    const last = sorted[sorted.length - 1];
    for (const t of c.topic_tags ?? []) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
    return {
      id: c.id,
      owner_handle: c.owner_handle,
      last_active_at: c.last_active_at,
      topic_tags: c.topic_tags ?? [],
      message_count: sorted.length,
      ai_message_count: sorted.filter((m) => m.role === "assistant").length,
      first_user_message: firstUser?.content_redacted ?? null,
      last_message: last
        ? { role: last.role as ChatMessage["role"], content: last.content_redacted }
        : null,
    };
  });

  const top_tags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    user,
    total_public_chats: rows.length,
    top_tags,
    recent_chats,
  };
}
