import Link from "next/link";

export const dynamic = "force-static";

// Sponsor wall — PLAN.md §7.3. Tier display is aspirational until both
// GitHub Sponsors + Open Collective onboardings finish; when they do, the
// HREFs below switch from "#" placeholders to the real URLs.
//
// Env-overridable so the URLs don't need a code change at the moment of
// approval — set NEXT_PUBLIC_GITHUB_SPONSORS_URL + NEXT_PUBLIC_OPEN_COLLECTIVE_URL
// on Render and redeploy.

const GITHUB_SPONSORS_URL = process.env.NEXT_PUBLIC_GITHUB_SPONSORS_URL ?? "";
const OPEN_COLLECTIVE_URL = process.env.NEXT_PUBLIC_OPEN_COLLECTIVE_URL ?? "";

const PLACEHOLDER_TIERS = [
  { tier: "$3 / mo", label: "Friend", perks: ["Supporter badge on profile"] },
  { tier: "$10 / mo", label: "Backer", perks: ["Supporter badge", "2× rate limits"] },
  { tier: "$25 / mo", label: "Sponsor", perks: ["All of the above", "Early-access to new chat modes"] },
  { tier: "$100 / mo", label: "Patron", perks: ["All of the above", "Name on this page in bold"] },
];

export default function SponsorsPage() {
  const ghReady = GITHUB_SPONSORS_URL.length > 0;
  const ocReady = OPEN_COLLECTIVE_URL.length > 0;

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
          ← Home
        </Link>
      </header>

      <section className="mb-6 rounded-md border border-[var(--border)] p-4">
        <h2 className="mb-2 font-medium">How it works</h2>
        <p className="text-sm text-[var(--muted)]">
          Everything on this site is and will stay free — no paywall, no Pro
          tier, no ads. Running cost target: under $20/month. Anything raised
          beyond that funds the next feature, transparently. See{" "}
          <Link href="/costs" className="text-[var(--accent)] hover:underline">
            /costs
          </Link>{" "}
          for the live breakdown.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-[var(--muted)]">
          Two ways to donate
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <DonateCard
            title="GitHub Sponsors"
            blurb="Low-friction for devs. Recurring + one-time both supported. Goes straight to the maintainer."
            href={ghReady ? GITHUB_SPONSORS_URL : null}
            cta="Sponsor on GitHub →"
            pending={!ghReady}
          />
          <DonateCard
            title="Open Collective"
            blurb="Tax-deductible receipts via Open Source Collective (501(c)(3) fiscal host). Public budget. Best for companies + larger donations."
            href={ocReady ? OPEN_COLLECTIVE_URL : null}
            cta="Donate on Open Collective →"
            pending={!ocReady}
          />
        </div>
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
          everything. Perks are cosmetic + small rate-limit bumps.
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

function DonateCard({
  title,
  blurb,
  href,
  cta,
  pending,
}: {
  title: string;
  blurb: string;
  href: string | null;
  cta: string;
  pending: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--border)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{title}</h3>
        {pending && (
          <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-mono text-orange-600 dark:text-orange-400">
            pending approval
          </span>
        )}
      </div>
      <p className="text-xs text-[var(--muted)]">{blurb}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto inline-block rounded-md bg-[var(--accent)] px-3 py-1.5 text-center text-xs font-medium text-white hover:opacity-90"
        >
          {cta}
        </a>
      ) : (
        <button
          type="button"
          disabled
          className="mt-auto inline-block rounded-md border border-dashed border-[var(--border)] px-3 py-1.5 text-center text-xs text-[var(--muted)]"
          title="Approval pending — link goes live once the host approves."
        >
          {cta}
        </button>
      )}
    </div>
  );
}
