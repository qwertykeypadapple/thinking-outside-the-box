import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getIdentity } from "@/lib/identity/cookie";
import {
  getChat,
  getMessages,
  type Visibility,
} from "@/lib/chat/store";
import {
  findSimilarChats,
  findSimilarChatsForChat,
  type Match,
} from "@/lib/chat/match";
import { ChatView } from "@/components/chat-view";
import { recordEvent } from "@/lib/analytics/store";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  const identity = await getIdentity();
  if (!identity) throw new Error("identity missing — proxy did not run");

  const chat = await getChat(chatId);
  if (!chat) notFound();

  const isOwner = chat.owner_handle === identity.handle;
  const visibility: Visibility = chat.visibility === "public" ? "public" : "unlisted";

  const h = await headers();
  const isNew = h.get("x-handle-new") === "1";

  // In the "anyone can continue" model, matches are useful to everyone — not
  // just the original chat owner — so we always query them.
  const [messages, similar] = await Promise.all([
    getMessages(chatId),
    findMatches(chatId, chat.owner_handle, chat.topic_tags),
  ]);

  void recordEvent("page_view", identity.handle, {
    path: `/c/${chatId}`,
    owner: chat.owner_handle,
    isOwner,
  });

  return (
    <ChatView
      handle={identity.handle}
      ownerHandle={chat.owner_handle}
      chatId={chatId}
      isOwner={isOwner}
      visibility={visibility}
      initialMessages={messages}
      similar={similar}
      showHandleNotice={isNew}
    />
  );
}

// Composite match: try the single-round-trip embedding match first (one
// Postgres call). If it returns no rows (chat lacks an embedding, RPC not yet
// deployed, etc.) fall back to tag-overlap. Both share the Match shape so
// SimilarStrip renders either equivalently.
async function findMatches(
  chatId: string,
  ownerHandle: string,
  tags: string[],
): Promise<Match[]> {
  const semantic = await findSimilarChatsForChat(chatId, tags).catch(() => [] as Match[]);
  if (semantic.length > 0) return semantic;
  if (tags.length > 0) return findSimilarChats(chatId, ownerHandle, tags);
  return [];
}
