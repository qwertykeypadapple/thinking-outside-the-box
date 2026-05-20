"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChatMessage } from "@/lib/llm";
import type { Visibility } from "@/lib/chat/store";
import type { Match } from "@/lib/chat/match";
import {
  deleteChatAction,
  setChatVisibility,
  startNewChat,
} from "@/app/actions";
import { RealtimeMatchTrigger } from "@/components/realtime-match-trigger";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  handle: string;
  ownerHandle: string;
  chatId: string;
  isOwner: boolean;
  visibility: Visibility;
  initialMessages: ChatMessage[];
  similar?: Match[];
  showHandleNotice?: boolean;
};

export function ChatView({
  handle,
  ownerHandle,
  chatId,
  isOwner,
  visibility: initialVisibility,
  initialMessages,
  similar = [],
  showHandleNotice: initialShowNotice = false,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const streamingRef = useRef(false);
  // Live broadcast deltas keyed by assistant messageId, for messages we are
  // NOT currently streaming ourselves. Renders as a transient assistant bubble
  // until the canonical row arrives via router.refresh on 'done'.
  const [liveStreams, setLiveStreams] = useState<Record<string, string>>({});
  const [showHandleNotice, setShowHandleNotice] = useState(initialShowNotice);
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep messages in sync when the server prop changes (router.refresh from
  // realtime + post-stream finalize updates initialMessages).
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, liveStreams]);

  // Subscribe to the per-chat broadcast channel. When a non-self viewer is
  // mid-stream, tokens land here and we render them as a transient bubble.
  // Skipped entirely when we ourselves are the requester (HTTP stream wins).
  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    const channel = sb.channel(`chat:${chatId}`, {
      config: { broadcast: { self: false, ack: false } },
    });

    channel.on("broadcast", { event: "token" }, (msg) => {
      if (streamingRef.current) return; // our own HTTP stream is authoritative
      const { messageId, delta } = (msg.payload ?? {}) as { messageId?: string; delta?: string };
      if (!messageId || typeof delta !== "string") return;
      setLiveStreams((prev) => ({ ...prev, [messageId]: (prev[messageId] ?? "") + delta }));
    });

    channel.on("broadcast", { event: "done" }, (msg) => {
      const { messageId } = (msg.payload ?? {}) as { messageId?: string };
      if (!messageId) return;
      // Drop the transient buffer and let router.refresh pull the canonical
      // row from the DB. Small delay so the swap doesn't flicker the bubble.
      setLiveStreams((prev) => {
        if (!(messageId in prev)) return prev;
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      router.refresh();
    });

    channel.subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [chatId, router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    // Multi-author: anyone viewing a public/unlisted chat can post — gate
    // removed. Server still enforces visibility-based permission.
    if (!text || streaming) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, senderHandle: handle },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setStreaming(true);
    streamingRef.current = true;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message: text }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => res.statusText);
        const prefix = res.status === 429 ? "" : "[error: ";
        const suffix = res.status === 429 ? "" : "]";
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: `${prefix}${errText}${suffix}` };
          return next;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: acc };
          return next;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network error";
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: `[error: ${msg}]` };
        return next;
      });
    } finally {
      setStreaming(false);
      streamingRef.current = false;
      router.refresh();
    }
  }

  async function onDelete() {
    if (!confirm("Delete this chat? This can't be undone.")) return;
    await deleteChatAction(chatId);
  }

  function onVisibilityChange(next: Visibility) {
    if (next === visibility) return;
    if (next === "public") {
      const ok = confirm(
        "Make this chat public?\n\n" +
          "It will appear on /feed and be readable by anyone with the link.\n" +
          "Structured PII (emails, phones, cards, IPs, etc.) is already redacted, but " +
          "anything else you wrote is visible as-is.",
      );
      if (!ok) return;
    }
    const prev = visibility;
    setVisibility(next); // optimistic
    startTransition(async () => {
      try {
        await setChatVisibility(chatId, next);
      } catch {
        setVisibility(prev);
        alert("Failed to update visibility.");
      }
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-4">
      {/* Anyone viewing this chat may also be typing into it — keep their
          SimilarStrip live whether they're the original owner or a continuer. */}
      <RealtimeMatchTrigger />
      <header className="mb-4 flex flex-col gap-3 border-b border-[var(--border)] pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">Think Outside the Box</h1>
            <p className="text-xs text-[var(--muted)]">Think in public. Find your people.</p>
          </div>
          {/* On mobile the handle sits with the title so the action row below
              can be a clean toolbar. On sm+ this collapses into the right
              cluster via the duplicate Link further down (hidden on mobile). */}
          <Link
            href={`/u/${handle}`}
            className="shrink-0 text-right hover:underline sm:hidden"
            aria-label="Your profile"
          >
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">you are</div>
            <div className="font-mono text-sm">{handle}</div>
          </Link>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 sm:overflow-visible sm:mx-0 sm:px-0">
          <Link
            href="/feed"
            className="shrink-0 rounded-md border border-[var(--border)] px-3 py-2 text-xs hover:bg-black/3 dark:hover:bg-white/5 sm:py-1.5"
            title="Browse public chats"
          >
            Feed
          </Link>
          <Link
            href="/search"
            className="shrink-0 rounded-md border border-[var(--border)] px-3 py-2 text-xs hover:bg-black/3 dark:hover:bg-white/5 sm:py-1.5"
            title="Search public chats"
          >
            Search
          </Link>
          <form action={startNewChat} className="shrink-0">
            <button
              type="submit"
              className="rounded-md border border-[var(--border)] px-3 py-2 text-xs hover:bg-black/3 dark:hover:bg-white/5 sm:py-1.5"
              title="Start a new chat"
            >
              + New
            </button>
          </form>
          <Link
            href={`/u/${handle}`}
            className="hidden text-right hover:underline sm:block"
          >
            <div className="text-xs text-[var(--muted)]">you are</div>
            <div className="font-mono text-sm">{handle}</div>
          </Link>
        </div>
      </header>

      {isOwner && (
        <div className="mb-4 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[var(--muted)]">
            <span>Visibility:</span>
            <VisibilityPicker value={visibility} onChange={onVisibilityChange} />
            {messages.length > 0 && (
              <button
                type="button"
                onClick={onDelete}
                disabled={streaming}
                className="rounded-md border border-[var(--border)] px-2 py-1 text-[var(--muted)] hover:border-red-400 hover:text-red-500 disabled:opacity-40"
                title="Delete this chat"
              >
                Delete chat
              </button>
            )}
          </div>
          <p className="text-[var(--muted)] sm:text-right">
            {visibilityHint(visibility)}
          </p>
        </div>
      )}

      {!isOwner && (
        <div className="mb-4 rounded-md border border-[var(--border)] bg-black/3 p-3 text-xs text-[var(--muted)] dark:bg-white/5">
          <p>
            You're viewing{" "}
            <Link
              href={`/u/${ownerHandle}`}
              className="font-mono text-[var(--foreground)] hover:underline"
            >
              {ownerHandle}
            </Link>
            's chat. Visibility: <span className="font-mono">{visibility}</span>.
          </p>
        </div>
      )}

      {similar.length > 0 && <SimilarStrip matches={similar} />}

      {showHandleNotice && isOwner && (
        <div className="mb-4 rounded-md border border-[var(--border)] bg-black/3 p-3 text-sm dark:bg-white/5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[var(--muted)]">
              Your handle <span className="font-mono text-[var(--foreground)]">{handle}</span> lives on this device only.
              Switching devices or clearing cookies means a fresh handle — by design.
            </p>
            <button
              onClick={() => setShowHandleNotice(false)}
              className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              aria-label="Dismiss notice"
            >
              dismiss
            </button>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto pb-4"
        style={{ minHeight: "320px" }}
      >
        {messages.length === 0 && !streaming && (
          <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
            {isOwner
              ? "Start a conversation. Anything you'd usually Google, ask here instead."
              : "This chat hasn't started yet — be the first to ask."}
          </div>
        )}
        {messages.map((m, i) => {
          // If we have a live-stream buffer for this assistant row, that's
          // fresher than what the server initially served — render the live
          // text and the "typing" affordance instead of the empty placeholder.
          const liveDelta = m.id ? liveStreams[m.id] : undefined;
          const isPending = m.status === "pending";
          const displayContent = liveDelta ?? m.content;
          return (
            <Message
              key={m.id ?? i}
              role={m.role}
              content={displayContent}
              senderHandle={m.senderHandle ?? null}
              viewerHandle={handle}
              pending={isPending || liveDelta !== undefined}
            />
          );
        })}
        {/* Live streams that don't yet have a corresponding messages[] entry
            (we haven't router-refreshed since they started). Drop them once
            their messageId appears in the persisted list. */}
        {Object.entries(liveStreams)
          .filter(([id]) => !messages.some((m) => m.id === id))
          .map(([id, content]) => (
            <Message
              key={`live:${id}`}
              role="assistant"
              content={content}
              senderHandle={null}
              viewerHandle={handle}
              pending
            />
          ))}
      </div>

      <form onSubmit={onSubmit} className="mt-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
          placeholder={
            streaming
              ? "thinking…"
              : isOwner
                ? "ask anything"
                : `continue ${ownerHandle}'s chat as ${handle}`
          }
          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
          autoFocus
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="shrink-0 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function SimilarStrip({ matches }: { matches: Match[] }) {
  const noun = matches.length === 1 ? "person is" : "people are";
  return (
    <div className="mb-4 rounded-md border border-[var(--border)] bg-[var(--accent)]/3 p-3 dark:bg-[var(--accent)]/10">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-[var(--foreground)]">
          <span className="font-semibold">{matches.length}</span>{" "}
          <span className="text-[var(--muted)]">{noun} exploring something similar</span>
        </span>
        <span className="text-[10px] text-[var(--muted)]">last 24h · public chats</span>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {matches.map((m) => (
          <div
            key={m.id}
            className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs transition-colors hover:border-[var(--accent)]"
          >
            <Link
              href={`/u/${m.owner_handle}`}
              className="font-mono text-sm text-[var(--foreground)] hover:underline"
            >
              {m.owner_handle}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {m.shared_tags.slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-[var(--accent)]/15 px-1.5 py-0.5 font-mono text-[10px] text-[var(--accent)]"
                >
                  #{t}
                </span>
              ))}
              {m.shared_tags.length === 0 && typeof m.distance === "number" && (
                <span className="font-mono text-[10px] text-[var(--muted)]">~ semantic</span>
              )}
            </div>
            <Link
              href={`/c/${m.id}`}
              className="mt-1 inline-block text-[10px] text-[var(--accent)] hover:underline"
            >
              open chat →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisibilityPicker({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (next: Visibility) => void;
}) {
  const options: { id: Visibility; label: string }[] = [
    { id: "unlisted", label: "Unlisted" },
    { id: "public", label: "Public" },
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-[var(--border)]">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={
            "px-2.5 py-1 text-xs transition-colors " +
            (value === o.id
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--muted)] hover:bg-black/3 dark:hover:bg-white/5")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function visibilityHint(v: Visibility): string {
  switch (v) {
    case "unlisted":
      return "Anyone with the link can read, but it's not in the feed.";
    case "public":
      return "Visible in the public feed.";
  }
}

function Message({
  role,
  content,
  senderHandle,
  viewerHandle,
  pending,
}: ChatMessage & { viewerHandle: string; pending?: boolean }) {
  const isUser = role === "user";
  // Only show the speaker label when we have one AND it isn't the viewer
  // (you already know what you typed). Assistant messages don't get a label.
  const showSender =
    isUser && senderHandle && senderHandle !== viewerHandle;
  return (
    <div className={isUser ? "flex flex-col items-end" : "flex flex-col items-start"}>
      {showSender && (
        <span className="mb-0.5 text-[10px] font-mono text-[var(--muted)]">
          {senderHandle}
        </span>
      )}
      <div
        className={
          "max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-2 text-sm leading-relaxed " +
          (isUser
            ? "bg-[var(--accent)] text-white"
            : "border border-[var(--border)] bg-black/3 dark:bg-white/5")
        }
      >
        {content || (
          <span className="opacity-50">{pending ? "typing…" : "…"}</span>
        )}
        {pending && content && (
          <span className="ml-1 inline-block animate-pulse text-[var(--muted)]">▊</span>
        )}
      </div>
    </div>
  );
}
