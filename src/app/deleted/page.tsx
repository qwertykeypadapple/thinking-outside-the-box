import Link from "next/link";

export const dynamic = "force-static";

// Landing after a successful /delete-me. By the time the visitor lands here
// their cookie is already cleared, so they have no identity. Layout will
// mount the Turnstile widget (if enabled) since isHumanVerified is now
// false — fine, that's the normal "new visitor" path on the next click.
export default function DeletedPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-12 pb-4">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Your data is gone.</h1>
      <p className="mb-2 text-sm text-[var(--muted)]">
        Your profile, all chats you owned, your follows, and your event history have
        been permanently erased from the database. Messages you contributed to other
        people&apos;s chats remain, but with no handle attached — they&apos;re anonymous
        now.
      </p>
      <p className="mb-6 text-sm text-[var(--muted)]">
        Your identity cookie has been cleared. The next page you visit will mint a
        fresh handle — but that&apos;s a new identity with no link to the one you just
        deleted.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/"
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Start fresh
        </Link>
        <Link
          href="/feed"
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-black/3 dark:hover:bg-white/5"
        >
          Browse public chats
        </Link>
      </div>
    </div>
  );
}
