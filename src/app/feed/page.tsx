import Link from "next/link";
import {
  listPublicChatsWithPreview,
  type PublicChatPreview,
} from "@/lib/chat/store";
import {
  listFollowees,
  listFollowedTags,
  listFollowingChats,
} from "@/lib/follows/store";
import { getIdentity } from "@/lib/identity/cookie";
import { keywordSearch, semanticSearch, type SearchHit } from "@/lib/search/store";
import { recordEvent } from "@/lib/analytics/store";
import { SearchResults } from "@/components/search-results";

export const dynamic = "force-dynamic";

type Tab = "trending" | "following";
const TABS: { id: Tab; label: string }[] = [
  { id: "trending", label: "Trending" },
  { id: "following", label: "Following" },
];

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const params = await searchParams;
  const tab: Tab = params.tab === "following" ? "following" : "trending";
  const query = (params.q ?? "").trim();
  const identity = await getIdentity();

  // Two paths: search (dual keyword + semantic, matching /search) vs browse
  // (chat cards). Branching at the data layer instead of after — keeps the
  // unused path entirely off the request.
  let keyword: SearchHit[] = [];
  let semantic: SearchHit[] = [];
  let browseChats: PublicChatPreview[] = [];

  if (query) {
    ({ keyword, semantic } = await runSearch(query, tab, identity?.handle ?? null));
  } else {
    browseChats =
      tab === "following" && identity
        ? await listFollowingChats(identity.handle, 50)
        : await listPublicChatsWithPreview(50);
  }

  const totalHits = query ? keyword.length + semantic.length : browseChats.length;

  void recordEvent("page_view", identity?.handle ?? null, {
    path: "/feed",
    tab,
    hasQuery: query.length > 0,
    resultCount: totalHits,
  });
  if (query) {
    void recordEvent("search", identity?.handle ?? null, {
      surface: "feed",
      tab,
      qLen: query.length,
      keywordCount: keyword.length,
      semanticCount: semantic.length,
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-4">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Feed</h1>
          <p className="text-xs text-[var(--muted)]">
            {query
              ? `${totalHits} match${totalHits === 1 ? "" : "es"} in ${tab === "trending" ? "Trending" : "Following"} for “${query}”.`
              : `${browseChats.length} chat${browseChats.length === 1 ? "" : "s"} ${tab === "trending" ? "thinking out loud right now" : "from people you follow"}.`}
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-black/3 dark:hover:bg-white/5"
        >
          ← Your chat
        </Link>
      </header>

      <nav className="mb-3 inline-flex overflow-hidden rounded-md border border-[var(--border)] self-start">
        {TABS.map((t) => (
          <Link
            key={t.id}
            // Preserve the active query when switching tabs so the user can
            // re-scope a search without retyping.
            href={
              t.id === "trending"
                ? query
                  ? `/feed?q=${encodeURIComponent(query)}`
                  : "/feed"
                : `/feed?tab=${t.id}${query ? `&q=${encodeURIComponent(query)}` : ""}`
            }
            className={
              "px-3 py-1.5 text-xs transition-colors " +
              (tab === t.id
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:bg-black/3 dark:hover:bg-white/5")
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <form action="/feed" method="get" className="mb-4 flex gap-2">
        {/* Re-emit `tab` as a hidden input so the form action preserves it. */}
        {tab !== "trending" && <input type="hidden" name="tab" value={tab} />}
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={
            tab === "trending"
              ? "search all public chats…"
              : "search within Following…"
          }
          className="flex-1 rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
        {query && (
          <Link
            href={tab === "trending" ? "/feed" : `/feed?tab=${tab}`}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Clear
          </Link>
        )}
      </form>

      {query ? (
        // Search mode: matches /search exactly via the shared component.
        // Following-scope was already applied in runSearch().
        <SearchResults keyword={keyword} semantic={semantic} query={query} />
      ) : browseChats.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <ul className="space-y-3">
          {browseChats.map((c) => (
            <li key={c.id}>
              <FeedCard chat={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Run both search paths in parallel; if we're in the Following tab, restrict
// each list to chats whose owner is a followee OR whose tags overlap a
// followed tag. The shared SearchResults component handles the keyword-vs-
// semantic dedup itself.
async function runSearch(
  query: string,
  tab: Tab,
  myHandle: string | null,
): Promise<{ keyword: SearchHit[]; semantic: SearchHit[] }> {
  const [kw, sem] = await Promise.all([
    keywordSearch(query, 20).catch(() => [] as SearchHit[]),
    semanticSearch(query, 20).catch(() => [] as SearchHit[]),
  ]);

  if (tab !== "following") return { keyword: kw, semantic: sem };
  if (!myHandle) return { keyword: [], semantic: [] };

  const [followees, tags] = await Promise.all([
    listFollowees(myHandle),
    listFollowedTags(myHandle),
  ]);
  if (followees.length === 0 && tags.length === 0) {
    return { keyword: [], semantic: [] };
  }
  const followeeSet = new Set(followees);
  const tagSet = new Set(tags);
  const inScope = (h: SearchHit) =>
    followeeSet.has(h.owner_handle) || h.topic_tags.some((t) => tagSet.has(t));

  return { keyword: kw.filter(inScope), semantic: sem.filter(inScope) };
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="rounded-md border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
      {tab === "trending" ? (
        <>
          No public chats yet. Be the first — open a chat and flip its visibility to{" "}
          <span className="font-mono">Public</span>.
        </>
      ) : (
        <>
          You aren't following anyone yet. Open a profile from{" "}
          <Link href="/feed" className="underline">
            Trending
          </Link>{" "}
          and click <span className="font-mono">Follow</span> to populate this tab.
        </>
      )}
    </div>
  );
}

function FeedCard({ chat }: { chat: PublicChatPreview }) {
  const title = chat.first_user_message
    ? truncate(chat.first_user_message, 160)
    : "(no opening message)";
  const reply = chat.last_message && chat.last_message.role === "assistant"
    ? truncate(chat.last_message.content, 220)
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
        <span>{relativeTime(chat.last_active_at)} · {chat.ai_message_count} AI repl{chat.ai_message_count === 1 ? "y" : "ies"}</span>
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
