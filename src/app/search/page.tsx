import Link from "next/link";
import { keywordSearch, semanticSearch, type SearchHit } from "@/lib/search/store";
import { getIdentity } from "@/lib/identity/cookie";
import { recordEvent } from "@/lib/analytics/store";
import { SearchResults } from "@/components/search-results";
import { BrandMark } from "@/components/brand-mark";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();

  const [keyword, semantic] = query
    ? await Promise.all([
        keywordSearch(query, 20).catch(() => [] as SearchHit[]),
        semanticSearch(query, 20).catch(() => [] as SearchHit[]),
      ])
    : [[] as SearchHit[], [] as SearchHit[]];

  const identity = await getIdentity();
  void recordEvent("page_view", identity?.handle ?? null, {
    path: "/search",
    hasQuery: query.length > 0,
  });
  if (query) {
    void recordEvent("search", identity?.handle ?? null, {
      surface: "search",
      qLen: query.length,
      keywordCount: keyword.length,
      semanticCount: semantic.length,
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-4">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <BrandMark size={40} />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Search</h1>
            <p className="text-xs text-[var(--muted)]">Public chats only.</p>
          </div>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-black/3 dark:hover:bg-white/5"
        >
          ← Your chat
        </Link>
      </header>

      <form action="/search" className="mb-6">
        <input
          name="q"
          defaultValue={query}
          placeholder="search content or topic…"
          className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
          autoFocus
        />
      </form>

      {!query ? (
        <p className="rounded-md border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
          Type something. Keyword search matches against message content; semantic
          search (if enabled) finds conceptually-similar conversations even with
          different vocabulary.
        </p>
      ) : (
        <SearchResults keyword={keyword} semantic={semantic} query={query} />
      )}
    </div>
  );
}
