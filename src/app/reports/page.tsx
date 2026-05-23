import Link from "next/link";
import { notFound } from "next/navigation";
import { getIdentity } from "@/lib/identity/cookie";
import { listOpenReports } from "@/lib/reports/store";
import { ResolveButtons } from "./resolve-buttons";
import { BrandMark } from "@/components/brand-mark";

export const dynamic = "force-dynamic";

// Admin-only. Set ADMIN_HANDLE=<your-handle> in .env.local to access.
// Without ADMIN_HANDLE set, the route 404s for everyone.
export default async function ReportsPage() {
  const admin = process.env.ADMIN_HANDLE;
  const identity = await getIdentity();
  if (!admin || identity?.handle !== admin) notFound();

  const reports = await listOpenReports(200);

  return (
    <div className="apple-page mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-4">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <BrandMark size={40} />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Open reports</h1>
            <p className="text-xs text-[var(--muted)]">
              {reports.length} open · admin view
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

      {reports.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
          Nothing pending. Nice.
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => {
            const isAuto = !r.reporter_handle && !!r.auto_category;
            return (
              <li key={r.id} className="rounded-md border border-[var(--border)] p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    {isAuto ? (
                      <span className="rounded-sm bg-orange-500/15 px-1.5 py-0.5 font-mono text-[10px] text-orange-600 dark:text-orange-400">
                        auto · {r.auto_category}
                        {r.auto_confidence != null && <> {(r.auto_confidence * 100).toFixed(0)}%</>}
                      </span>
                    ) : (
                      <span className="rounded-sm bg-[var(--accent)]/10 px-1.5 py-0.5 font-mono text-[10px] text-[var(--accent)]">
                        user-reported
                      </span>
                    )}
                    <Link href={`/c/${r.chat_id}`} className="font-mono text-[var(--foreground)] hover:underline">
                      open chat ↗
                    </Link>
                    {r.reporter_handle && (
                      <span>by <span className="user-name-shine font-mono">{r.reporter_handle}</span></span>
                    )}
                  </span>
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="mb-2 whitespace-pre-wrap text-sm">{r.reason}</p>
                {!isAuto && r.auto_category && (
                  <p className="mb-2 text-xs text-[var(--muted)]">
                    Auto-classifier on this chat: <span className="font-mono">{r.auto_category}</span>
                    {r.auto_confidence != null && <> ({(r.auto_confidence * 100).toFixed(0)}%)</>}
                  </p>
                )}
                <ResolveButtons id={r.id} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
