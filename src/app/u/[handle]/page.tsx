import Link from "next/link";
import { notFound } from "next/navigation";
import { getIdentity } from "@/lib/identity/cookie";
import { getProfileSummary, upsertUser } from "@/lib/users/store";
import {
  countFollowers,
  countFollowing,
  isFollowing,
} from "@/lib/follows/store";
import type { PublicChatPreview } from "@/lib/chat/store";
import { EditBio } from "./edit-bio";
import { DeleteMe } from "./delete-me";
import { FollowButton } from "@/components/follow-button";
import { BrandMark } from "@/components/brand-mark";
import { recordEvent } from "@/lib/analytics/store";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const identity = await getIdentity();

  let summary = await getProfileSummary(handle);
  // Lazy-create the user row if it's the visitor's own profile and they
  // somehow never sent a chat (which would have created it via the route).
  if (!summary && identity?.handle === handle) {
    await upsertUser(handle);
    summary = await getProfileSummary(handle);
  }
  if (!summary) notFound();

  const isSelf = identity?.handle === handle;
  const [followerCount, followingCount, alreadyFollowing] = await Promise.all([
    countFollowers(handle),
    countFollowing(handle),
    identity && !isSelf ? isFollowing(identity.handle, handle) : Promise.resolve(false),
  ]);

  void recordEvent("page_view", identity?.handle ?? null, {
    path: `/u/${handle}`,
    isSelf,
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-4">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <BrandMark size={40} />
          <div className="min-w-0">
            <h1 className="font-mono text-2xl font-semibold tracking-tight break-all">{summary.user.handle}</h1>
            <p className="text-xs text-[var(--muted)]">
              joined {relativeTime(summary.user.created_at)} · last seen {relativeTime(summary.user.last_seen_at)}
              <br className="sm:hidden" />
              <span className="hidden sm:inline">{" · "}</span>
              <span className="font-mono">{followerCount}</span> follower{followerCount === 1 ? "" : "s"}
              {" · "}
              <span className="font-mono">{followingCount}</span> following
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isSelf && identity && (
            <FollowButton targetHandle={handle} initialFollowing={alreadyFollowing} />
          )}
          <Link
            href="/"
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-black/3 dark:hover:bg-white/5"
          >
            ← Your chat
          </Link>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">Bio</h2>
        {isSelf ? (
          <EditBio handle={handle} initialBio={summary.user.bio} />
        ) : (
          <p className="text-sm">
            {summary.user.bio ? (
              summary.user.bio
            ) : (
              <span className="italic text-[var(--muted)]">No bio yet.</span>
            )}
          </p>
        )}
      </section>


      <section className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Public chats</div>
          <div className="text-2xl font-semibold">{summary.total_public_chats}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Top tags</div>
          {summary.top_tags.length === 0 ? (
            <div className="text-sm text-[var(--muted)] italic">none yet</div>
          ) : (
            <div className="mt-1 flex flex-wrap gap-1">
              {summary.top_tags.map(({ tag, count }) => (
                <Link
                  key={tag}
                  href={`/feed#${tag}`}
                  className="rounded-full bg-black/5 px-2 py-0.5 font-mono text-[11px] text-[var(--foreground)] dark:bg-white/10"
                  title={`${count} ${count === 1 ? "chat" : "chats"}`}
                >
                  #{tag}
                  <span className="ml-1 text-[var(--muted)]">{count}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">Recent public chats</h2>
        {summary.recent_chats.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
            {isSelf
              ? "You haven't made any chats public yet. Flip a chat to Public to see it here."
              : "No public chats yet."}
          </p>
        ) : (
          <ul className="space-y-3">
            {summary.recent_chats.map((c) => (
              <li key={c.id}>
                <ProfileChatCard chat={c} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Danger zone — self-service erasure. Lives at the very bottom of the
          profile, separated by extra whitespace + a divider, so the destructive
          control is hard to reach by accident. */}
      {isSelf && (
        <section className="mt-12 border-t border-[var(--border)] pt-6">
          <h2 className="mb-2 text-xs uppercase tracking-wider text-red-600 dark:text-red-400">
            Danger zone
          </h2>
          <DeleteMe currentHandle={handle} />
        </section>
      )}
    </div>
  );
}

function ProfileChatCard({ chat }: { chat: PublicChatPreview }) {
  const title = chat.first_user_message
    ? truncate(chat.first_user_message, 140)
    : "(no opening message)";
  return (
    <Link
      href={`/c/${chat.id}`}
      className="block rounded-lg border border-[var(--border)] p-3 transition-colors hover:bg-black/3 dark:hover:bg-white/5"
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <span>{relativeTime(chat.last_active_at)}</span>
        <span>{chat.ai_message_count} AI repl{chat.ai_message_count === 1 ? "y" : "ies"}</span>
      </div>
      {chat.topic_tags.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1">
          {chat.topic_tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded-full bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted)] dark:bg-white/10"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
      <p className="text-sm">{title}</p>
    </Link>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + "…";
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}
