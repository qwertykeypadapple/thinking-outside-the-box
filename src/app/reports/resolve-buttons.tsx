"use client";

import { useTransition } from "react";
import { resolveReportAction } from "@/app/actions";

export function ResolveButtons({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-2 text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { await resolveReportAction(id, "resolved"); })}
        className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-black/3 dark:hover:bg-white/5"
      >
        Resolved
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { await resolveReportAction(id, "dismissed"); })}
        className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-black/3 dark:hover:bg-white/5"
      >
        Dismiss
      </button>
    </div>
  );
}
