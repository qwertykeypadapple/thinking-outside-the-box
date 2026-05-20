import { NextRequest } from "next/server";
import { getOrCreateIdentity } from "@/lib/identity/cookie";
import { getProvider } from "@/lib/llm";
import { SYSTEM_PROMPT } from "@/lib/llm/system-prompt";
import {
  appendMessageReturningId,
  createChat,
  deleteChat,
  finalizeAssistantMessage,
  getChat,
  getMessages,
  getUserMessageContext,
  insertPendingAssistant,
  updateChatEmbedding,
  updateChatTags,
  updateMessageModeration,
} from "@/lib/chat/store";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { redact } from "@/lib/pii/redact";
import { extractTags } from "@/lib/llm/tag-extractor";
import { getEmbeddingProvider } from "@/lib/embeddings";
import { getUser, upsertUser } from "@/lib/users/store";
import { checkAndIncrement } from "@/lib/rate-limit/store";
import { classifyMessage, shouldAutoReport } from "@/lib/llm/moderator";
import { createAutoReport } from "@/lib/reports/store";
import { recordEvent } from "@/lib/analytics/store";
import { isHumanVerified } from "@/lib/identity/human-cookie";
import { getHardLimitUsd, isOverHardLimit, recordUsage } from "@/lib/llm/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { chatId?: unknown; message?: unknown };

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

// Fire-and-forget tag extraction. Runs after the chat response is streamed.
// In dev / long-lived server: completes fine. In serverless prod we'll move
// this to a queue once we deploy — for now, intentional best-effort.
async function tagInBackground(chatId: string): Promise<void> {
  try {
    const messages = await getMessages(chatId);
    const tags = await extractTags(messages);
    if (tags.length > 0) await updateChatTags(chatId, tags);
  } catch {
    // Tag failures must never bubble — they're cosmetic.
  }
}

// Fire-and-forget embedding refresh — gated on VOYAGE_API_KEY being set.
// Embeds the concatenated last 5 user messages so the vector reflects what
// the user is currently exploring, not stale openings or model prose.
async function embedInBackground(chatId: string): Promise<void> {
  const provider = getEmbeddingProvider();
  if (!provider) return;
  try {
    const text = await getUserMessageContext(chatId, 5);
    if (!text.trim()) return;
    const vec = await provider.embed(text, { kind: "document" });
    await updateChatEmbedding(chatId, vec);
  } catch {
    // Embedding failures must never bubble.
  }
}

// Fire-and-forget moderation. Stamps the message row with the classifier's
// verdict and auto-files a report when the verdict crosses the threshold.
// Disabled by setting MODERATION_DISABLED=1 (useful for tests / cost cuts).
async function moderateInBackground(
  chatId: string,
  messageId: string,
  text: string,
  role: "user" | "assistant",
): Promise<void> {
  if (process.env.MODERATION_DISABLED === "1") return;
  try {
    const verdict = await classifyMessage(text, role);
    if (!verdict) return;
    await updateMessageModeration(messageId, verdict.category, verdict.confidence).catch(() => {});
    if (shouldAutoReport(verdict)) {
      await createAutoReport({
        chatId,
        category: verdict.category,
        confidence: verdict.confidence,
        reason: verdict.reason || `${role} flagged`,
        messageId,
      }).catch(() => {});
    }
  } catch {
    // Moderation failures must never bubble — the user-facing report flow
    // catches anything the classifier misses.
  }
}

export async function POST(req: NextRequest) {
  const { handle } = await getOrCreateIdentity();

  // Bot gate: refuse the LLM call if the visitor hasn't passed Turnstile
  // recently. isHumanVerified() soft-bypasses when TURNSTILE_SECRET_KEY is
  // unset (dev/CI). Client receives 403 with a structured reason so the chat
  // UI can prompt re-verification.
  if (!(await isHumanVerified())) {
    return new Response("complete verification", {
      status: 403,
      headers: { "X-Verification-Required": "turnstile" },
    });
  }

  // Spend kill-switch (PLAN.md §7.2). If today's cumulative Anthropic spend
  // has hit the hard limit, refuse new LLM calls until midnight UTC. Per-
  // handle rate limits cap individual abuse; this caps aggregate spend
  // across all users together. Soft-disables when LLM_KILLSWITCH_DISABLED=1
  // and when the llm_usage table doesn't exist yet (getDailySpendUsd returns
  // 0 on error).
  if (await isOverHardLimit()) {
    const limit = getHardLimitUsd();
    return new Response(
      `Service paused: today's spend limit ($${limit}) reached. Donate at /sponsors to help keep this free.`,
      { status: 429, headers: { "Retry-After": String(secondsUntilUtcMidnight()) } },
    );
  }

  // Rate limit BEFORE any LLM call — these limits double as cost ceilings
  // (PLAN.md §7.2). Failure to look up the user falls back to "fresh" limits.
  const userRow = await getUser(handle).catch(() => null);
  const decision = await checkAndIncrement(handle, userRow?.created_at ?? null).catch(() => null);
  if (decision && !decision.ok) {
    const mins = Math.ceil(decision.resetInSec / 60);
    return new Response(
      `Rate limit reached (${decision.limit}/${decision.bucket}). Try again in ~${mins} minute${mins === 1 ? "" : "s"}.`,
      { status: 429, headers: { "Retry-After": String(decision.resetInSec) } },
    );
  }

  // Fire-and-forget user upsert — creates the profile row on first chat,
  // refreshes last_seen_at on subsequent ones. Profile failures must not
  // block the chat.
  void upsertUser(handle).catch(() => {});

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const userText = typeof body.message === "string" ? body.message.trim() : "";
  if (!userText) return new Response("empty message", { status: 400 });
  if (userText.length > 8000) return new Response("message too long", { status: 413 });

  let chatId = typeof body.chatId === "string" ? body.chatId : "";
  if (chatId) {
    const existing = await getChat(chatId);
    if (!existing) return new Response("chat not found", { status: 404 });
    // Open continuation model: anyone may post into any public/unlisted chat.
    // Private chats remain owner-only.
    const isOwner = existing.owner_handle === handle;
    const isJoinable = existing.visibility === "public" || existing.visibility === "unlisted";
    if (!isOwner && !isJoinable) {
      return new Response("forbidden", { status: 403 });
    }
  } else {
    const created = await createChat(handle);
    chatId = created.id;
    void recordEvent("chat_started", handle, { chatId, via: "first_message" });
  }

  // Redact PII before storage — raw content never persisted (PLAN.md §4.5).
  // LLM history is loaded from DB after this insert, so the model sees the
  // redacted version too. Live stream below stays raw so the owner sees
  // their typed-back message naturally; the persisted record is sanitized.
  const { text: userRedacted } = redact(userText);
  const userMessageId = await appendMessageReturningId(chatId, {
    role: "user",
    content: userRedacted,
    senderHandle: handle,
  });
  // Moderation pass on the user's turn — runs in parallel with the LLM call
  // so it doesn't add latency to the assistant stream.
  void moderateInBackground(chatId, userMessageId, userRedacted, "user");
  void recordEvent("message_sent", handle, { chatId, len: userText.length });

  const history = await getMessages(chatId);
  const provider = getProvider();

  // Option C: insert the assistant row up front (status='pending') so other
  // viewers of this chat can render a "live" bubble while the LLM streams,
  // and so a reopened tab can tell that a reply is mid-flight. Broadcast each
  // token on a per-chat channel — no DB write per token.
  const assistantMessageId = await insertPendingAssistant(chatId);

  // Server-side broadcast sender. We subscribe to the chat's broadcast channel
  // so we can publish without round-tripping through the realtime REST API.
  // Failures here must never block the user's HTTP stream — they're cosmetic
  // (single-viewer mode still works fine via the direct stream).
  const sbAdmin = getSupabaseAdmin();
  const channel = sbAdmin.channel(`chat:${chatId}`, {
    config: { broadcast: { self: false, ack: false } },
  });
  const subscribed = new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        resolve();
      }
    });
  });

  function emit(event: "token" | "done", payload: Record<string, unknown>): void {
    // fire-and-forget; do not await — keeps streaming latency low.
    void channel.send({ type: "broadcast", event, payload }).catch(() => {});
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let assistant = "";
      // Subscribe is fast (~50–150ms); start it in parallel with the LLM
      // call but don't block the first HTTP token on it.
      void subscribed;
      try {
        const iter = provider.streamChat(
          [{ role: "system", content: SYSTEM_PROMPT }, ...history],
          { signal: req.signal },
        );
        for await (const delta of iter) {
          assistant += delta;
          controller.enqueue(encoder.encode(delta));
          // Broadcast to non-requesting viewers (channel { self: false } so
          // we don't loop the requester's own HTTP stream back into their UI).
          emit("token", { messageId: assistantMessageId, delta });
        }
        if (assistant) {
          // Assistant output is just as much a PII risk — the model can echo
          // user-shared PII or hallucinate convincing-looking data.
          const { text: assistantRedacted } = redact(assistant);
          await finalizeAssistantMessage(assistantMessageId, assistantRedacted);
          emit("done", { messageId: assistantMessageId, content: assistantRedacted });
          // Tag, embed, moderate, and record spend in parallel. All four are
          // best-effort: the user's request is already served by this point.
          void tagInBackground(chatId);
          void embedInBackground(chatId);
          void moderateInBackground(chatId, assistantMessageId, assistantRedacted, "assistant");
          // Token estimate is char-based (~4 chars/token). Close enough for a
          // $-gate that fires at $15/$25. Inputs = system prompt + full
          // history; outputs = just the assistant reply.
          const inputText = [SYSTEM_PROMPT, ...history.map((m) => m.content)].join("\n\n");
          void recordUsage({ model: provider.model, inputText, outputText: assistantRedacted });
        } else {
          // Empty stream — likely an immediate error or empty model output.
          // Finalize with a marker so the placeholder doesn't stay pending.
          await finalizeAssistantMessage(assistantMessageId, "[empty reply]");
          emit("done", { messageId: assistantMessageId, content: "[empty reply]" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream error";
        controller.enqueue(encoder.encode(`\n\n[error: ${msg}]`));
        // Don't leave the row in 'pending' forever — record whatever we got
        // plus the error suffix, then close out the broadcast.
        const partial = assistant ? `${assistant}\n\n[error: ${msg}]` : `[error: ${msg}]`;
        await finalizeAssistantMessage(assistantMessageId, redact(partial).text).catch(() => {});
        emit("done", { messageId: assistantMessageId, content: partial });
      } finally {
        controller.close();
        void sbAdmin.removeChannel(channel).catch(() => {});
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Chat-Id": chatId,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const { handle } = await getOrCreateIdentity();
  const chatId = new URL(req.url).searchParams.get("chatId");
  if (!chatId) return new Response("missing chatId", { status: 400 });

  const chat = await getChat(chatId);
  if (!chat) return new Response("not found", { status: 404 });
  if (chat.owner_handle !== handle) return new Response("forbidden", { status: 403 });

  await deleteChat(chatId);
  return Response.json({ ok: true });
}
