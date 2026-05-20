import Link from "next/link";
import Image from "next/image";
import { requireIdentity } from "@/lib/identity/require-identity";
import {
  listChats,
  listPublicChatsWithPreview,
  type PublicChatPreview,
} from "@/lib/chat/store";
import { listFollowingChats } from "@/lib/follows/store";
import { topTags } from "@/lib/analytics/store";
import { recordEvent } from "@/lib/analytics/store";
import { startNewChat } from "@/app/actions";
import { ChatCard } from "@/components/chat-card";

export const dynamic = "force-dynamic";

// Discovery hub per PLAN §2.2 — replaces the redirect-to-last-chat that
// served Wave 1.5. This is what first-time visitors actually land on now.
//
// Deferred from the full §2.2 spec until we have data to back them:
//   - Velocity score (needs view tracking)
//   - Reputation/Trending People (§2.3 — needs ≥20 active users to be useful)
//   - Surprising matches (needs cross-chat pair mining)
//   - Active co-think rooms (no rooms concept yet — open continuation only)
//   - Today/Week sub-toggle (single 24h window for now)
//
// What's here: tags trending in the last 7d (good signal at any traffic
// level), most-recent active public chats, follow-graph filter, and a clear
// "start a chat" CTA so a first-time visitor knows where to begin.

type Tab = "trending" | "live" | "following";
const TABS: { id: Tab; label: string; desc: string }[] = [
  { id: "trending", label: "Trending", desc: "What people are exploring this week" },
  { id: "live", label: "Live", desc: "Recent public chats" },
  { id: "following", label: "Following", desc: "From people and topics you follow" },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; welcome?: string }>;
}) {
  // First-time visitors get minted via /mint; returning visitors pass straight
  // through. The ?welcome=1 query param is set by /mint on a fresh mint —
  // shows a one-time "your handle lives on this device" notice below.
  const identity = await requireIdentity("/");

  const sp = await searchParams;
  const tab: Tab =
    sp.tab === "live" ? "live" : sp.tab === "following" ? "following" : "trending";
  const isNew = sp.welcome === "1";

  // Fetch in parallel — most-recent chat (for the "continue last" CTA) is
  // always fetched; per-tab data is whichever tab is active.
  const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [myRecent, tagsWeek, tabChats] = await Promise.all([
    listChats(identity.handle, 1),
    topTags(sinceWeek, 12),
    fetchTabChats(tab, identity.handle),
  ]);

  void recordEvent("page_view", identity.handle, { path: "/", tab });

  const lastChatId = myRecent[0]?.id ?? null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-8">
      <Header handle={identity.handle} lastChatId={lastChatId} />

      {isNew && <WelcomeBanner handle={identity.handle} />}

      <TabBar active={tab} />

      {tab === "trending" && (
        <TrendingPanel tags={tagsWeek} chats={tabChats} handle={identity.handle} />
      )}
      {tab === "live" && (
        <LivePanel chats={tabChats} />
      )}
      {tab === "following" && (
        <FollowingPanel chats={tabChats} />
      )}

      <Footer />
    </div>
  );
}

async function fetchTabChats(
  tab: Tab,
  handle: string,
): Promise<PublicChatPreview[]> {
  if (tab === "following") return listFollowingChats(handle, 50);
  return listPublicChatsWithPreview(50);
}

function Header({ handle, lastChatId }: { handle: string; lastChatId: string | null }) {
  return (
    <header className="mb-6 flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {/* Logo as a brand mark next to the wordmark. priority because it's
            above-the-fold on every visit. width=72 keeps the file lightweight
            but readable; the alt text intentionally leaves the brand name to
            the h1 below it to avoid double-announcement for screen readers. */}
        <Image
          src="/logo.png"
          alt=""
          width={72}
          height={72}
          priority
          className="shrink-0"
        />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            Thinking Outside the Box
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Anonymously ask in public,
            <br />
            see how many have the same queries like you.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {lastChatId && (
          <Link
            href={`/c/${lastChatId}`}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-black/3 dark:hover:bg-white/5"
            title="Continue your most recent chat"
          >
            ← Your last chat
          </Link>
        )}
        <form action={startNewChat}>
          <button
            type="submit"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Start a chat
          </button>
        </form>
        <Link
          href={`/u/${handle}`}
          className="text-right text-xs hover:underline"
          title="Your profile"
        >
          <span className="block text-[10px] uppercase tracking-wider text-[var(--muted)]">
            you are
          </span>
          <span className="block font-mono text-sm">{handle}</span>
        </Link>
      </div>
    </header>
  );
}

function WelcomeBanner({ handle }: { handle: string }) {
  return (
    <div className="mb-6 rounded-md border border-[var(--border)] bg-[var(--accent)]/5 p-3 text-sm">
      <p className="text-[var(--muted)]">
        Welcome! Your handle{" "}
        <span className="font-mono text-[var(--foreground)]">{handle}</span> lives on
        this device only — clear your cookies or switch devices and you get a fresh
        identity, by design. No account, no email, no password to remember.
      </p>
    </div>
  );
}

function TabBar({ active }: { active: Tab }) {
  return (
    <nav className="mb-4 inline-flex self-start overflow-hidden rounded-md border border-[var(--border)]">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={t.id === "trending" ? "/" : `/?tab=${t.id}`}
          className={
            "px-4 py-1.5 text-xs transition-colors " +
            (active === t.id
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--muted)] hover:bg-black/3 dark:hover:bg-white/5")
          }
          title={t.desc}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

function TrendingPanel({
  tags,
  chats,
  handle,
}: {
  tags: { tag: string; count: number }[];
  chats: PublicChatPreview[];
  handle: string;
}) {
  return (
    <>
      <section className="mb-6">
        <h2 className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">
          Topics this week
        </h2>
        {tags.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
            No tagged public chats yet. Be the first — start a chat above.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <li key={t.tag}>
                <Link
                  href={`/feed?q=${encodeURIComponent(t.tag)}`}
                  className="rounded-full bg-black/5 px-3 py-1 font-mono text-xs text-[var(--foreground)] hover:bg-[var(--accent)]/15 dark:bg-white/10"
                >
                  #{t.tag}
                  <span className="ml-1.5 text-[var(--muted)]">{t.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">
          Recent public chats
        </h2>
        {chats.length === 0 ? (
          <EmptyTrendingState handle={handle} />
        ) : (
          <ul className="space-y-3">
            {chats.slice(0, 12).map((c) => (
              <li key={c.id}>
                <ChatCard chat={c} />
              </li>
            ))}
          </ul>
        )}
        {chats.length > 12 && (
          <div className="mt-3 text-center">
            <Link
              href="/feed"
              className="text-xs text-[var(--accent)] hover:underline"
            >
              See all {chats.length}+ on /feed →
            </Link>
          </div>
        )}
      </section>
    </>
  );
}

function LivePanel({ chats }: { chats: PublicChatPreview[] }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">
        {chats.length} public chat{chats.length === 1 ? "" : "s"} in the last 24h
      </h2>
      {chats.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
          No public chats yet. Open a chat and flip its visibility to{" "}
          <span className="font-mono">Public</span>.
        </p>
      ) : (
        <ul className="space-y-3">
          {chats.map((c) => (
            <li key={c.id}>
              <ChatCard chat={c} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FollowingPanel({ chats }: { chats: PublicChatPreview[] }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">
        From people and topics you follow
      </h2>
      {chats.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
          You aren&apos;t following anyone yet. Open a profile from{" "}
          <Link href="/?tab=live" className="text-[var(--accent)] hover:underline">
            Live
          </Link>{" "}
          and click <span className="font-mono">Follow</span> to populate this tab.
        </p>
      ) : (
        <ul className="space-y-3">
          {chats.map((c) => (
            <li key={c.id}>
              <ChatCard chat={c} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyTrendingState({ handle }: { handle: string }) {
  return (
    <div className="rounded-md border border-dashed border-[var(--border)] p-8 text-center text-sm">
      <p className="mb-2 text-[var(--muted)]">
        No public chats yet. Start one and flip visibility to{" "}
        <span className="font-mono">Public</span> from the chat header.
      </p>
      <p className="text-xs text-[var(--muted)]">
        You&apos;re <span className="font-mono">{handle}</span>. Anything you write
        publicly shows up here for others exploring the same topic.
      </p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
      <div className="flex flex-wrap gap-3">
        <Link href="/search" className="hover:text-[var(--foreground)]">
          Search
        </Link>
        <Link href="/feed" className="hover:text-[var(--foreground)]">
          Full feed
        </Link>
        <Link href="/sponsors" className="hover:text-[var(--foreground)]">
          Sponsors
        </Link>
        <Link href="/costs" className="hover:text-[var(--foreground)]">
          Costs
        </Link>
      </div>
      <div>
        Free · open source · donation-funded
      </div>
    </footer>
  );
}
