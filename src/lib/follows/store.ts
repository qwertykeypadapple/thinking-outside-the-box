import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { PublicChatPreview } from "@/lib/chat/store";
import type { ChatMessage } from "@/lib/llm";

export async function followHandle(follower: string, followee: string): Promise<void> {
  if (follower === followee) return;
  const { error } = await getSupabaseAdmin()
    .from("follows")
    .upsert({ follower_handle: follower, followee_handle: followee }, { onConflict: "follower_handle,followee_handle" });
  if (error) throw new Error(`followHandle: ${error.message}`);
}

export async function unfollowHandle(follower: string, followee: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("follows")
    .delete()
    .eq("follower_handle", follower)
    .eq("followee_handle", followee);
  if (error) throw new Error(`unfollowHandle: ${error.message}`);
}

export async function isFollowing(follower: string, followee: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("follows")
    .select("follower_handle")
    .eq("follower_handle", follower)
    .eq("followee_handle", followee)
    .maybeSingle();
  if (error) throw new Error(`isFollowing: ${error.message}`);
  return !!data;
}

export async function countFollowers(handle: string): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("followee_handle", handle);
  if (error) throw new Error(`countFollowers: ${error.message}`);
  return count ?? 0;
}

export async function countFollowing(handle: string): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_handle", handle);
  if (error) throw new Error(`countFollowing: ${error.message}`);
  return count ?? 0;
}

export async function listFollowees(handle: string): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("follows")
    .select("followee_handle")
    .eq("follower_handle", handle);
  if (error) throw new Error(`listFollowees: ${error.message}`);
  return ((data ?? []) as { followee_handle: string }[]).map((r) => r.followee_handle);
}

async function getTopicFollows(handle: string): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("topic_follows")
    .select("tag")
    .eq("handle", handle);
  if (error) throw new Error(`getTopicFollows: ${error.message}`);
  return ((data ?? []) as { tag: string }[]).map((r) => r.tag);
}

type ChatWithMessages = {
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

// Following feed: public chats from people the user follows, plus chats whose
// topic_tags overlap any tag the user follows. Deduped by id, sorted by recency.
export async function listFollowingChats(
  handle: string,
  limit = 50,
): Promise<PublicChatPreview[]> {
  const [followees, tags] = await Promise.all([listFollowees(handle), getTopicFollows(handle)]);
  if (followees.length === 0 && tags.length === 0) return [];

  const sb = getSupabaseAdmin();

  // Build OR filter: from followees OR tag-overlap
  const filters: string[] = [];
  if (followees.length > 0) {
    const list = followees.map((h) => `"${h.replace(/"/g, "")}"`).join(",");
    filters.push(`owner_handle.in.(${list})`);
  }
  if (tags.length > 0) {
    const tagList = `{${tags.join(",")}}`;
    filters.push(`topic_tags.ov.${tagList}`);
  }

  const { data, error } = await sb
    .from("chats")
    .select("id, owner_handle, last_active_at, topic_tags, messages(role, content_redacted, created_at, status)")
    .eq("visibility", "public")
    .or(filters.join(","))
    .order("last_active_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listFollowingChats: ${error.message}`);

  return ((data ?? []) as ChatWithMessages[])
    .map<PublicChatPreview>((c) => {
      const sorted = c.messages
        .filter((m) => (m.status ?? "complete") === "complete")
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      const firstUser = sorted.find((m) => m.role === "user");
      const last = sorted[sorted.length - 1];
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
    })
    .filter((c) => c.message_count > 0);
}

export async function followTag(handle: string, tag: string): Promise<void> {
  const normalized = tag.toLowerCase().trim();
  const { error } = await getSupabaseAdmin()
    .from("topic_follows")
    .upsert({ handle, tag: normalized }, { onConflict: "handle,tag" });
  if (error) throw new Error(`followTag: ${error.message}`);
}

export async function unfollowTag(handle: string, tag: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("topic_follows")
    .delete()
    .eq("handle", handle)
    .eq("tag", tag.toLowerCase().trim());
  if (error) throw new Error(`unfollowTag: ${error.message}`);
}

export async function listFollowedTags(handle: string): Promise<string[]> {
  return getTopicFollows(handle);
}
