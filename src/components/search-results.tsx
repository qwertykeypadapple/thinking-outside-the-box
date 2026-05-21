import Link from "next/link";
import type { SearchHit } from "@/lib/search/store";
import { stripMarkdown, truncate } from "@/lib/format";

// Shared search-result rendering, used by /search and by /feed?q=…
// Keeps both surfaces in sync: same dual-section layout, same excerpt
// highlighting, same per-hit metadata.
export function SearchResults({
  keyword,
  semantic,
  query,
}: {
  keyword: SearchHit[];
  semantic: SearchHit[];
  query: string;
}) {
  // Drop semantic hits that are already in the keyword list so we don't
  // render the same chat twice. Keyword excerpts are richer (they carry the
  // ts_headline highlight) so they win on overlap.
  const keywordIds = new Set(keyword.map((h) => h.id));
  const semanticOnly = semantic.filter((h) => !keywordIds.has(h.id));

  if (keyword.length === 0 && semanticOnly.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
        No matches for <span className="font-mono">{query}</span>.
      </p>
    );
  }

  return (
    <>
      {keyword.length > 0 && (
        <Section
          title="Keyword matches"
          subtitle={`${keyword.length} chat${keyword.length === 1 ? "" : "s"}`}
        >
          {keyword.map((h) => (
            <HitCard key={h.id} hit={h} />
          ))}
        </Section>
      )}
      {semanticOnly.length > 0 && (
        <Section
          title="Semantically similar"
          subtitle={`${semanticOnly.length} chat${semanticOnly.length === 1 ? "" : "s"} · different words, related topic`}
        >
          {semanticOnly.map((h) => (
            <HitCard key={h.id} hit={h} />
          ))}
        </Section>
      )}
    </>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs uppercase tracking-wider text-[var(--muted)]">{title}</h2>
        <span className="text-xs text-[var(--muted)]">{subtitle}</span>
      </div>
      <ul className="space-y-3">{children}</ul>
    </section>
  );
}

function HitCard({ hit }: { hit: SearchHit }) {
  return (
    <li className="rounded-lg border border-[var(--border)] transition-colors hover:bg-black/3 dark:hover:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pt-3 text-xs text-[var(--muted)]">
        <Link
          href={`/u/${hit.owner_handle}`}
          className="font-mono text-[var(--foreground)] hover:underline"
        >
          {hit.owner_handle}
        </Link>
        <span>
          {relativeTime(hit.last_active_at)}
          {typeof hit.distance === "number" && (
            <> · {(hit.distance).toFixed(2)} dist</>
          )}
        </span>
      </div>
      <Link href={`/c/${hit.id}`} className="block px-4 pb-3 pt-2">
        {hit.topic_tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {hit.topic_tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-full bg-black/5 px-2 py-0.5 font-mono text-[10px] text-[var(--muted)] dark:bg-white/10"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
        {hit.excerpt && (
          <p
            className="text-sm text-[var(--foreground)]"
            dangerouslySetInnerHTML={{ __html: highlightExcerpt(hit.excerpt) }}
          />
        )}
        {hit.last_ai_message && (
          <p
            className={
              "border-l-2 border-[var(--border)] pl-2 text-sm text-[var(--muted)] " +
              (hit.excerpt ? "mt-2" : "")
            }
          >
            {truncate(stripMarkdown(hit.last_ai_message), 220)}
          </p>
        )}
        {!hit.excerpt && !hit.last_ai_message && (
          <p className="text-sm italic text-[var(--muted)]">(no preview)</p>
        )}
      </Link>
    </li>
  );
}

// Highlights «matched» segments with <mark>. Source string is already
// sanitized: it's PII-redacted content + ts_headline output (Postgres) using
// known delimiters we control. Still escape everything to be safe.
function highlightExcerpt(s: string): string {
  const escaped = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped
    .replace(/«/g, '<mark class="bg-[var(--accent)]/20 px-0.5 rounded">')
    .replace(/»/g, "</mark>");
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
