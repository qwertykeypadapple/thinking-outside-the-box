"use client";

import { useState, useTransition } from "react";
import { reportChatAction } from "@/app/actions";

export function ReportButton({ chatId }: { chatId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <span className="text-xs text-[var(--muted)]">Reported. We'll review it.</span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-[var(--muted)] hover:text-red-500 hover:underline"
        title="Report this chat"
      >
        Report
      </button>
    );
  }

  function onSubmit() {
    const r = reason.trim();
    if (!r) return setError("Tell us what's wrong.");
    setError(null);
    startTransition(async () => {
      try {
        await reportChatAction(chatId, r);
        setDone(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't submit.");
      }
    });
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-1">
      <textarea
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        placeholder="What's wrong with this chat? (harassment, doxxing, illegal content, etc.)"
        rows={2}
        className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1 text-xs focus:border-[var(--accent)] focus:outline-none"
        disabled={pending}
      />
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      <div className="flex justify-end gap-2 text-xs">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setReason("");
            setError(null);
          }}
          disabled={pending}
          className="rounded-md border border-[var(--border)] px-2 py-1 hover:bg-black/3 dark:hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="rounded-md bg-[var(--accent)] px-2 py-1 text-white disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Submit"}
        </button>
      </div>
    </div>
  );
}
