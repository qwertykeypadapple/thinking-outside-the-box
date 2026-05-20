import Link from "next/link";

export const dynamic = "force-static";

// Transparent operating costs page (PLAN.md §7.1).
// Numbers below are TARGETS / TYPICALS; update them with real billing data
// once we're deployed. Cap is enforced in code via the rate limiter (PLAN.md §7.2).
const monthly = [
  { item: "Vercel (Hobby)", cost: "$0", note: "Free tier — 100 GB bandwidth, unlimited builds." },
  { item: "Supabase (Free)", cost: "$0", note: "500 MB DB, 50k MAU, 5 GB egress." },
  { item: "Cloudflare (Free) + Turnstile", cost: "$0", note: "CDN + DDoS + invisible human check." },
  { item: "Anthropic Claude (Sonnet 4.6 + Haiku 4.5)", cost: "≤ $15", note: "Model split + prompt caching + Batch API. Kill switch at $25/mo." },
  { item: "Voyage AI embeddings", cost: "≈ $0", note: "Free tier covers 200M tokens/month — plenty at our scale." },
  { item: "Domain registration", cost: "≈ $1", note: "Amortized monthly." },
  { item: "GitHub (Free)", cost: "$0", note: "Public repo + Actions minutes." },
  { item: "Sentry (Free)", cost: "$0", note: "5k errors/month." },
];

export default function CostsPage() {
  const max = monthly.reduce((sum, m) => sum + (m.cost.match(/[\d.]+/)?.[0] ? parseFloat(m.cost.match(/[\d.]+/)![0]) : 0), 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-4">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">What this costs to run</h1>
          <p className="text-xs text-[var(--muted)]">
            Open numbers, no surprises. Target: under $20/month while small.
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-black/3 dark:hover:bg-white/5"
        >
          ← Your chat
        </Link>
      </header>

      <section className="mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--muted)]">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Monthly</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((row) => (
              <tr key={row.item} className="border-b border-[var(--border)]/60 align-top">
                <td className="py-3 pr-4">
                  <div className="font-medium">{row.item}</div>
                  <div className="text-xs text-[var(--muted)]">{row.note}</div>
                </td>
                <td className="py-3 text-right font-mono">{row.cost}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-3">Target ceiling</td>
              <td className="py-3 text-right font-mono">≤ ${max.toFixed(0)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-6 rounded-md border border-[var(--border)] p-4 text-sm">
        <h2 className="mb-2 font-medium">Cost controls baked in</h2>
        <ul className="list-disc space-y-1 pl-5 text-[var(--muted)]">
          <li>Per-handle rate limits double as cost ceilings (30 msg/hr, 150 msg/day default; 10/hr for the first 24h on a new handle).</li>
          <li>Model split: Sonnet 4.6 only for user-facing replies; Haiku 4.5 for tagging, moderation, summarization.</li>
          <li>Prompt caching on the system prompt (90% discount on cached tokens).</li>
          <li>Anthropic console alert at $15/mo spend; automated read-only mode at $25/mo.</li>
        </ul>
      </section>

      <section>
        <p className="text-sm text-[var(--muted)]">
          Want to keep this free for everyone?{" "}
          <Link href="/sponsors" className="text-[var(--accent)] hover:underline">
            Become a supporter →
          </Link>
        </p>
      </section>
    </div>
  );
}
