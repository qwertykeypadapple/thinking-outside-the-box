import Link from "next/link";

export const dynamic = "force-static";

// Sponsor wall — PLAN.md §7.3. Real list pulled from GitHub Sponsors API
// once the Sponsors profile is approved.
const PLACEHOLDER_TIERS = [
  { tier: "$3 / mo", label: "Friend", perks: ["Supporter badge on profile"] },
  { tier: "$10 / mo", label: "Backer", perks: ["Supporter badge", "2× rate limits"] },
  { tier: "$25 / mo", label: "Sponsor", perks: ["All of the above", "Early-access to new chat modes"] },
  { tier: "$100 / mo", label: "Patron", perks: ["All of the above", "Name on this page in bold"] },
];

export default function SponsorsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-4">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Sponsors</h1>
          <p className="text-xs text-[var(--muted)]">
            Donations keep this platform free, open source, and ad-free.
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-black/3 dark:hover:bg-white/5"
        >
          ← Your chat
        </Link>
      </header>

      <section className="mb-6 rounded-md border border-[var(--border)] p-4">
        <h2 className="mb-2 font-medium">How it works</h2>
        <p className="text-sm text-[var(--muted)]">
          Everything on this site is and will stay free — no paywall, no Pro
          tier, no ads. We're funded entirely by{" "}
          <a
            href="https://github.com/sponsors"
            className="text-[var(--accent)] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub Sponsors
          </a>
          . Once we have a Sponsors profile, the link below will work.
        </p>
        <p className="mt-3">
          <a
            href="https://github.com/sponsors"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Become a sponsor →
          </a>
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-[var(--muted)]">Tiers</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PLACEHOLDER_TIERS.map((t) => (
            <li key={t.tier} className="rounded-md border border-[var(--border)] p-3">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{t.label}</span>
                <span className="font-mono text-sm">{t.tier}</span>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[var(--muted)]">
                {t.perks.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Features are <em>never</em> gated by sponsorship — anyone can do
          everything. Perks are cosmetic + small rate-limit bumps. See{" "}
          <Link href="/costs" className="text-[var(--accent)] hover:underline">
            /costs
          </Link>{" "}
          for what the money actually goes to.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wider text-[var(--muted)]">
          Sponsor wall
        </h2>
        <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
          Nobody yet — be the first.
        </div>
      </section>
    </div>
  );
}
