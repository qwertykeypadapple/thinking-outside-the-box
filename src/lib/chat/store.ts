import type { ChatMessage } from "@/lib/llm";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type Visibility = "unlisted" | "public";

export type ChatRecord = {
  id: string;
  owner_handle: string;
  visibility: Visibility;
  topic_tags: string[];
  summary: string | null;
  created_at: string;
  last_active_at: string;
};

export async function listChats(handle: string, limit = 50): Promise<ChatRecord[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("chats")
    .select("*")
    .eq("owner_handle", handle)
    .order("last_active_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listChats: ${error.message}`);
  return (data ?? []) as ChatRecord[];
}

export async function getChat(chatId: string): Promise<ChatRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("chats")
    .select("*")
    .eq("id", chatId)
    .maybeSingle();
  if (error) throw new Error(`getChat: ${error.message}`);
  return (data as ChatRecord) ?? null;
}

export async function createChat(
  handle: string,
  visibility: Visibility = "unlisted",
): Promise<ChatRecord> {
  const { data, error } = await getSupabaseAdmin()
    .from("chats")
    .insert({ owner_handle: handle, visibility })
    .select()
    .single();
  if (error) throw new Error(`createChat: ${error.message}`);
  return data as ChatRecord;
}

export async function deleteChat(chatId: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("chats").delete().eq("id", chatId);
  if (error) throw new Error(`deleteChat: ${error.message}`);
}

export async function updateChatVisibility(
  chatId: string,
  visibility: Visibility,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("chats")
    .update({ visibility })
    .eq("id", chatId);
  if (error) throw new Error(`updateChatVisibility: ${error.message}`);
}

export async function updateChatTags(chatId: string, tags: string[]): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("chats")
    .update({ topic_tags: tags })
    .eq("id", chatId);
  if (error) throw new Error(`updateChatTags: ${error.message}`);
}

export async function updateChatEmbedding(chatId: string, embedding: number[]): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("chats")
    .update({ summary_embedding: embedding })
    .eq("id", chatId);
  if (error) throw new Error(`updateChatEmbedding: ${error.message}`);
}

// Returns the user-message text the embedding should be computed over.
// Concatenated last N user messages — captures evolving topic without
// drowning intent in assistant prose.
export async function getUserMessageContext(chatId: string, last = 5): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .from("messages")
    .select("content_redacted, created_at")
    .eq("chat_id", chatId)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(last);
  if (error) throw new Error(`getUserMessageContext: ${error.message}`);
  return ((data ?? []) as { content_redacted: string }[])
    .reverse()
    .map((r) => r.content_redacted)
    .join("\n\n");
}

export async function getChatEmbedding(chatId: string): Promise<number[] | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("chats")
    .select("summary_embedding")
    .eq("id", chatId)
    .maybeSingle();
  if (error) throw new Error(`getChatEmbedding: ${error.message}`);
  const raw = (data as { summary_embedding: number[] | string | null } | null)?.summary_embedding;
  if (raw == null) return null;
  // pgvector returns either a number[] (sometimes) or a stringified vector
  // ("[0.1,0.2,...]") depending on driver. Normalize to number[].
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as number[];
    } catch {
      return null;
    }
  }
  return raw;
}

export type PublicChatPreview = {
  id: string;
  owner_handle: string;
  last_active_at: string;
  topic_tags: string[];
  message_count: number;
  ai_message_count: number;
  first_user_message: string | null;
  last_message: { role: ChatMessage["role"]; content: string } | null;
};

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

export async function listPublicChatsWithPreview(limit = 50): Promise<PublicChatPreview[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("chats")
    .select("id, owner_handle, last_active_at, topic_tags, messages(role, content_redacted, created_at, status)")
    .eq("visibility", "public")
    .order("last_active_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listPublicChatsWithPreview: ${error.message}`);

  return ((data ?? []) as ChatWithMessages[])
    .map((c) => {
      // Drop pending assistant placeholders — they have empty content and
      // would render as "(no preview)" cards. Once the stream finalizes the
      // row flips to 'complete' and shows normally.
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
          ? {
              role: last.role as ChatMessage["role"],
              content: last.content_redacted,
            }
          : null,
      };
    })
    .filter((c) => c.message_count > 0);
}

export async function getMessages(chatId: string): Promise<ChatMessage[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("messages")
    .select("id, role, content_redacted, sender_handle, status")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getMessages: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    role: r.role as ChatMessage["role"],
    content: r.content_redacted as string,
    senderHandle: (r as { sender_handle?: string | null }).sender_handle ?? null,
    status: ((r as { status?: string }).status ?? "complete") as
      | "pending"
      | "complete",
  }));
}

export async function appendMessage(chatId: string, message: ChatMessage): Promise<void> {
  const { error } = await getSupabaseAdmin().from("messages").insert({
    chat_id: chatId,
    role: message.role,
    content_redacted: message.content,
    sender_handle: message.senderHandle ?? null,
  });
  if (error) throw new Error(`appendMessage: ${error.message}`);
}

// Variant that returns the new row id — needed so the moderation pass can
// back-reference the offending message on auto-filed reports.
export async function appendMessageReturningId(
  chatId: string,
  message: ChatMessage,
): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .from("messages")
    .insert({
      chat_id: chatId,
      role: message.role,
      content_redacted: message.content,
      sender_handle: message.senderHandle ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`appendMessageReturningId: ${error.message}`);
  return data.id as string;
}

// Records the classifier verdict on a message row. Failures here are cosmetic
// (the report itself is the durable signal) — callers should swallow errors.
export async function updateMessageModeration(
  messageId: string,
  category: string,
  confidence: number,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("messages")
    .update({ moderation_category: category, moderation_confidence: confidence })
    .eq("id", messageId);
  if (error) throw new Error(`updateMessageModeration: ${error.message}`);
}

// Multi-viewer streaming (Option C). Creates an empty assistant row up front
// with status='pending'. The /api/chat handler then broadcasts tokens on a
// channel keyed by chat id; non-requesting viewers subscribe and render the
// live deltas without us touching the DB per-token. When the stream finishes,
// finalizeAssistantMessage replaces the placeholder with the canonical reply.
export async function insertPendingAssistant(chatId: string): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .from("messages")
    .insert({
      chat_id: chatId,
      role: "assistant",
      content_redacted: "",
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(`insertPendingAssistant: ${error.message}`);
  return data.id as string;
}

export async function finalizeAssistantMessage(
  messageId: string,
  content: string,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("messages")
    .update({ content_redacted: content, status: "complete" })
    .eq("id", messageId);
  if (error) throw new Error(`finalizeAssistantMessage: ${error.message}`);
}
