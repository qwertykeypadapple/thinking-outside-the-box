import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export const dynamic = "force-static";

export const metadata = {
  title: "Privacy Policy — Thinking Outside the Box",
  description:
    "What data this site holds, what it doesn't, and how to delete what little there is.",
};

const LAST_UPDATED = "2026-05-21";

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <BrandMark size={40} />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Privacy Policy</h1>
            <p className="text-xs text-[var(--muted)]">
              Last updated {LAST_UPDATED}
            </p>
          </div>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-black/3 dark:hover:bg-white/5"
        >
          ← Home
        </Link>
      </header>

      <Section title="The short version">
        <p>
          This site holds the minimum data needed to run an anonymous public-chat
          platform. There are no accounts, no emails, no passwords, and no
          payment information. Your identity is a random handle (e.g.{" "}
          <span className="font-mono">curious-otter-42</span>) stored in a signed
          cookie on your device. Clear the cookie or switch devices and you
          start fresh.
        </p>
      </Section>

      <Section title="What we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>An identity cookie.</strong> A signed, HttpOnly, Secure,
            SameSite=Lax cookie carrying your handle. We do not link this cookie
            to your real identity in any way.
          </li>
          <li>
            <strong>Chats you write.</strong> Your messages, the assistant&apos;s
            replies, and a per-chat visibility flag (Public or Unlisted).
            Public chats are visible to anyone on the site and via the public
            feed. Unlisted chats are reachable only by direct link.
          </li>
          <li>
            <strong>Voluntary profile data.</strong> Bio text, a one-time custom
            handle rename, and which other handles you follow. All optional.
          </li>
          <li>
            <strong>Topic embeddings of public chats.</strong> A numerical
            vector representation used to match co-thinkers exploring similar
            topics. Computed only on public content.
          </li>
          <li>
            <strong>Aggregated event logs.</strong> Page views, follow/unfollow,
            report submissions — used to drive the trending tab and detect
            abuse. Never sold; never shared except as listed below under{" "}
            <em>Third parties</em>.
          </li>
          <li>
            <strong>Hashed IP + User-Agent.</strong> Salted and hashed
            server-side for rate limiting and abuse detection. The raw values
            are never written to disk.
          </li>
        </ul>
      </Section>

      <Section title="What we do not collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>No email addresses, real names, phone numbers, or postal addresses.</li>
          <li>No passwords or any account credentials.</li>
          <li>No payment information. Donations flow through GitHub Sponsors and Open Collective directly; we never see your card or bank details.</li>
          <li>No advertising trackers, no analytics SDKs, no third-party pixels.</li>
        </ul>
      </Section>

      <Section title="Public-by-default + automatic PII redaction">
        <p>
          When you mark a chat as <strong>Public</strong>, an automated
          redaction pass removes structured personally identifying information
          before the chat appears in the public feed — emails, phone numbers,
          credit card numbers, IP addresses, and similar patterns. The
          redaction is best-effort, not perfect. <strong>Treat anything you
          write in a public chat as visible to the world forever.</strong>
        </p>
        <p>
          The chat header always shows the current visibility, and changing a
          chat to Public requires explicit confirmation.
        </p>
      </Section>

      <Section title="Cookies">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Identity cookie.</strong> Stores your signed handle ID.
            Required for the service to function — without it the site cannot
            attribute a message to you.
          </li>
          <li>
            <strong>Human-verification cookie.</strong> Set after you pass the
            invisible Cloudflare Turnstile check. Saves you from re-verifying
            on every request for ~24 hours.
          </li>
        </ul>
        <p>
          We do not use cookies for advertising, cross-site tracking, or
          analytics.
        </p>
      </Section>

      <Section title="Third parties we send data to">
        <p>
          We rely on a small number of service providers to operate the
          platform. Each receives only what it needs for its specific function.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Anthropic (Claude).</strong> Your chat messages are sent to
            Anthropic&apos;s API to generate replies. Anthropic&apos;s data
            policy applies. We do not include your handle, cookie, or any
            identifier in those requests.
          </li>
          <li>
            <strong>Supabase.</strong> Hosts the Postgres database and
            real-time channel. Encrypts disk and backups at rest.
          </li>
          <li>
            <strong>Cloudflare Turnstile.</strong> Verifies you&apos;re a human,
            not a bot, on first visit. We pass a verification token only.
          </li>
          <li>
            <strong>Voyage AI.</strong> Computes the topic embeddings used for
            matching. Only public chat content is sent.
          </li>
          <li>
            <strong>Sentry (errors only).</strong> Server-side error reports for
            debugging crashes. We strip user content and handles before sending.
          </li>
          <li>
            <strong>Render.</strong> Hosts the application. Standard server
            access logs apply.
          </li>
        </ul>
      </Section>

      <Section title="Retention">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Chats:</strong> kept indefinitely while they exist. When you
            delete a chat, it is soft-deleted for 7 days, then hard-deleted from
            primary storage.
          </li>
          <li>
            <strong>Database backups:</strong> nightly snapshots are retained
            for 7 days on the database provider, then rotated out.
          </li>
          <li>
            <strong>Hashed IP/UA records:</strong> kept for 30 days for abuse
            investigation, then rotated.
          </li>
          <li>
            <strong>Event logs:</strong> retained for 90 days in aggregate form;
            do not contain message content.
          </li>
        </ul>
      </Section>

      <Section title="Your rights">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Delete any chat:</strong> from the chat header → Delete chat.
          </li>
          <li>
            <strong>Delete everything tied to your handle:</strong> from your
            profile page (<span className="font-mono">/u/[your-handle]</span>)
            → Delete my data. This removes your chats, bio, follows, and your
            handle record.
          </li>
          <li>
            <strong>Walk away:</strong> clear your browser cookies. The handle
            is no longer associated with you; nobody can recover it.
          </li>
        </ul>
        <p>
          Because we hold no email or other contact identifier, we cannot
          authenticate a deletion request from anyone other than the device
          holding the cookie. This is intentional — it&apos;s also why anyone
          with access to your device has the same authority over your handle as
          you do.
        </p>
      </Section>

      <Section title="Children">
        <p>
          This service is not directed at children under 13. If you are under
          the minimum age of digital consent in your jurisdiction, please do
          not use it.
        </p>
      </Section>

      <Section title="Open source">
        <p>
          The code that handles your data is{" "}
          <a
            href="https://github.com/qwertykeypadapple/thinking-outside-the-box"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            open source
          </a>
          . You can read exactly what the server does with every request.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this policy as the platform evolves. Material changes
          will be noted by bumping the <em>Last updated</em> date at the top of
          this page and, where possible, surfaced in-product.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions? Open an issue on the{" "}
          <a
            href="https://github.com/qwertykeypadapple/thinking-outside-the-box/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            GitHub repo
          </a>
          . Security reports follow{" "}
          <a
            href="https://github.com/qwertykeypadapple/thinking-outside-the-box/blob/main/SECURITY.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            SECURITY.md
          </a>
          .
        </p>
      </Section>

      <footer className="mt-6 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
        <Link href="/terms" className="hover:text-[var(--foreground)]">
          Terms &amp; Conditions
        </Link>
        <span className="mx-2">·</span>
        <Link href="/" className="hover:text-[var(--foreground)]">
          Home
        </Link>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold tracking-tight">{title}</h2>
      <div className="space-y-2 text-sm text-[var(--muted)] leading-relaxed">
        {children}
      </div>
    </section>
  );
}
