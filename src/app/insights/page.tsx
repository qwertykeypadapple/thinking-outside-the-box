import Link from "next/link";
import { notFound } from "next/navigation";
import { getIdentity } from "@/lib/identity/cookie";
import {
  distinctHandleCount,
  eventCount,
  newHandleCount,
  recentEvents,
  topTags,
  type EventRecord,
} from "@/lib/analytics/store";
import {
  getDailySpendUsd,
  getHardLimitUsd,
  getSoftLimitUsd,
} from "@/lib/llm/usage";
import { BrandMark } from "@/components/brand-mark";

export const dynamic = "force-dynamic";

// Admin-only. Set ADMIN_HANDLE=<your-handle> in .env.local to access.
// Mirrors the gate used by /reports — no admin handle, no route.
export default async function InsightsPage() {
  const admin = process.env.ADMIN_HANDLE;
  const identity = await getIdentity();
  if (!admin || identity?.handle !== admin) notFound();

  const now = Date.now();
  const since = {
    "24h": new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    "7d": new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    "30d": new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  // Pull everything in parallel — these are independent reads.
  const [
    dau,
    wau,
    mau,
    newHandles24h,
    newHandles7d,
    chats24h,
    chats7d,
    msgs24h,
    msgs7d,
    publics24h,
    publics7d,
    follows7d,
    searches7d,
    reports7d,
    tags7d,
    recent,
    spendUsd,
  ] = await Promise.all([
    distinctHandleCount(since["24h"]),
    distinctHandleCount(since["7d"]),
    distinctHandleCount(since["30d"]),
    newHandleCount(since["24h"]),
    newHandleCount(since["7d"]),
    eventCount("chat_started", since["24h"]),
    eventCount("chat_started", since["7d"]),
    eventCount("message_sent", since["24h"]),
    eventCount("message_sent", since["7d"]),
    eventCount("chat_made_public", since["24h"]),
    eventCount("chat_made_public", since["7d"]),
    eventCount("follow", since["7d"]),
    eventCount("search", since["7d"]),
    eventCount("report_filed", since["7d"]),
    topTags(since["7d"], 12),
    recentEvents(50),
    getDailySpendUsd(),
  ]);
  const softLimit = getSoftLimitUsd();
  const hardLimit = getHardLimitUsd();
  const spendPct = hardLimit > 0 ? (spendUsd / hardLimit) * 100 : 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-4">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <BrandMark size={40} />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Insights</h1>
            <p className="text-xs text-[var(--muted)]">
              Self-hosted analytics · admin view · no third-party trackers
            </p>
          </div>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-black/3 dark:hover:bg-white/5"
        >
          ← Back
        </Link>
      </header>

      <Section title="Today's Anthropic spend">
        {/* Kill-switch trips at hard limit; soft limit is informational.
            spendPct shows progress toward hard. Red when ≥ soft. */}
        <div className="rounded-md border border-[var(--border)] p-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-2xl font-semibold font-mono">
              ${spendUsd.toFixed(2)}
              <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                of ${hardLimit.toFixed(0)} hard cap
              </span>
            </div>
            <div className={
              "text-xs font-mono " +
              (spendUsd >= hardLimit
                ? "text-red-600 dark:text-red-400"
                : spendUsd >= softLimit
                  ? "text-orange-600 dark:text-orange-400"
                  : "text-[var(--muted)]")
            }>
              {spendPct.toFixed(0)}%
            </div>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            <div
              className={
                "h-full " +
                (spendUsd >= hardLimit
                  ? "bg-red-500"
                  : spendUsd >= softLimit
                    ? "bg-orange-500"
                    : "bg-[var(--accent)]")
              }
              style={{ width: `${Math.min(100, spendPct).toFixed(1)}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] text-[var(--muted)]">
            Soft alert at ${softLimit.toFixed(0)} · hard cutoff at ${hardLimit.toFixed(0)} · resets UTC midnight.
            {spendUsd >= hardLimit && (
              <span className="ml-2 font-semibold text-red-600 dark:text-red-400">
                Service paused — new chats return 429 until reset.
              </span>
            )}
          </p>
        </div>
      </Section>

      <Section title="Active handles">
        <Grid>
          <Stat label="Today (24h)" value={dau} />
          <Stat label="This week (7d)" value={wau} />
          <Stat label="This month (30d)" value={mau} />
        </Grid>
      </Section>

      <Section title="New handles">
        <Grid>
          <Stat label="Last 24h" value={newHandles24h} />
          <Stat label="Last 7d" value={newHandles7d} />
        </Grid>
      </Section>

      <Section title="Chats started">
        <Grid>
          <Stat label="Last 24h" value={chats24h} />
          <Stat label="Last 7d" value={chats7d} />
        </Grid>
      </Section>

      <Section title="Messages sent">
        <Grid>
          <Stat label="Last 24h" value={msgs24h} />
          <Stat label="Last 7d" value={msgs7d} />
        </Grid>
      </Section>

      <Section title="Made public">
        <Grid>
          <Stat label="Last 24h" value={publics24h} />
          <Stat label="Last 7d" value={publics7d} />
        </Grid>
      </Section>

      <Section title="Other 7d signal">
        <Grid>
          <Stat label="Follows" value={follows7d} />
          <Stat label="Searches" value={searches7d} />
          <Stat label="Reports filed" value={reports7d} />
        </Grid>
      </Section>

      <Section title="Top tags this week">
        {tags7d.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No tagged public chats yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {tags7d.map((t) => (
              <li
                key={t.tag}
                className="rounded-full bg-black/5 px-2 py-0.5 font-mono text-xs text-[var(--foreground)] dark:bg-white/10"
              >
                #{t.tag}
                <span className="ml-1 text-[var(--muted)]">{t.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recent events">
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No events yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)] text-xs">
            {recent.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--border)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold font-mono">{value.toLocaleString()}</div>
    </div>
  );
}

function EventRow({ event }: { event: EventRecord }) {
  // Compact one-line summary. The props blob is shown raw — at admin volume
  // it's easier to spot anomalies than rendering each event type specially.
  const propsStr = Object.keys(event.props).length
    ? " " + JSON.stringify(event.props)
    : "";
  return (
    <li className="flex items-baseline gap-2 p-2 font-mono">
      <time className="shrink-0 text-[10px] text-[var(--muted)]">
        {new Date(event.created_at).toLocaleTimeString([], { hour12: false })}
      </time>
      <span className="shrink-0 rounded-sm bg-black/5 px-1.5 text-[10px] dark:bg-white/10">
        {event.type}
      </span>
      {event.handle && (
        <span className="shrink-0 text-[10px] text-[var(--foreground)]">{event.handle}</span>
      )}
      <span className="truncate text-[10px] text-[var(--muted)]">{propsStr}</span>
    </li>
  );
}
