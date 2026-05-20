"use client";

import { useState, useTransition } from "react";
import { deleteMyDataAction } from "@/app/actions";

// Self-service erasure UI on the user's own profile. Collapsed by default
// (single red button). Expanded into a confirmation dialog that requires
// the user to TYPE their handle to enable the final delete button — same
// pattern as GitHub's repo-delete + most platforms. Prevents accidental
// clicks when they meant to dismiss.
export function DeleteMe({ currentHandle }: { currentHandle: string }) {
  const [expanded, setExpanded] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canConfirm = typed.trim() === currentHandle && !pending;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => {
          setExpanded(true);
          setError(null);
        }}
        className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-600 hover:bg-red-500/10 dark:text-red-400"
        title="Delete every trace of this handle"
      >
        Delete my data
      </button>
    );
  }

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        // Successful action redirects to /deleted; this never returns.
        await deleteMyDataAction(currentHandle);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-2 rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm">
      <p className="font-medium text-red-700 dark:text-red-400">
        This permanently erases your data.
      </p>
      <ul className="ml-4 list-disc space-y-0.5 text-xs text-[var(--muted)]">
        <li>Your profile, bio, follows, and reports filed — gone.</li>
        <li>All chats you own — gone (along with every message inside them).</li>
        <li>
          Messages you sent in <em>other people&apos;s</em> chats stay, but with no
          handle attached. They become anonymous contributions.
        </li>
        <li>Your identity cookie is cleared — next visit mints a fresh handle.</li>
        <li>Can&apos;t be undone.</li>
      </ul>
      <label className="mt-1 text-xs">
        Type your handle{" "}
        <span className="font-mono text-[var(--foreground)]">{currentHandle}</span>{" "}
        to enable the delete button:
      </label>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoFocus
        disabled={pending}
        className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1 font-mono text-sm focus:border-red-500 focus:outline-none"
      />
      {error && <p className="text-[10px] text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end gap-2 text-xs">
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setTyped("");
            setError(null);
          }}
          disabled={pending}
          className="rounded-md border border-[var(--border)] px-3 py-1 hover:bg-black/3 dark:hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className="rounded-md bg-red-600 px-3 py-1 text-white disabled:opacity-40 hover:bg-red-700"
        >
          {pending ? "Erasing…" : "Permanently delete"}
        </button>
      </div>
    </div>
  );
}
