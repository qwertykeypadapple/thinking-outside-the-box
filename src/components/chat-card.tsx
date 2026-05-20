import Link from "next/link";
import type { PublicChatPreview } from "@/lib/chat/store";
import { relativeTime, stripMarkdown, truncate } from "@/lib/format";

// Single shared card for public-chat listings. Used on the homepage discovery
// hub and on /feed. Kept dumb (no client interactivity, no analytics, no
// data fetching) so callers can drop it into any list and the surrounding
// page owns the context.
//
// If the same card needs different sizing/density at some point, pass an
// optional `compact` prop — DON'T fork the component, the duplication that
// caused this extraction the first time is exactly that pattern.
export function ChatCard({ chat }: { chat: PublicChatPreview }) {
  const title = chat.first_user_message
    ? truncate(chat.first_user_message, 160)
    : "(no opening message)";
  const reply =
    chat.last_message && chat.last_message.role === "assistant"
      ? truncate(stripMarkdown(chat.last_message.content), 220)
      : null;

  return (
    <div className="rounded-lg border border-[var(--border)] transition-colors hover:bg-black/3 dark:hover:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pt-3 text-xs text-[var(--muted)]">
        <Link
          href={`/u/${chat.owner_handle}`}
          className="font-mono text-[var(--foreground)] hover:underline"
        >
          {chat.owner_handle}
        </Link>
        <span>
          {relativeTime(chat.last_active_at)} · {chat.ai_message_count} AI
          repl{chat.ai_message_count === 1 ? "y" : "ies"}
        </span>
      </div>
      <Link href={`/c/${chat.id}`} className="block px-4 pb-3 pt-2">
        {chat.topic_tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {chat.topic_tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-black/5 px-2 py-0.5 font-mono text-[10px] text-[var(--muted)] dark:bg-white/10"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
        <p className="text-sm text-[var(--foreground)]">{title}</p>
        {reply && (
          <p className="mt-2 border-l-2 border-[var(--border)] pl-2 text-sm text-[var(--muted)]">
            {reply}
          </p>
        )}
      </Link>
    </div>
  );
}
