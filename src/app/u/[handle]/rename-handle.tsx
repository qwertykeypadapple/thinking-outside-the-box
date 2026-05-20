"use client";

import { useState, useTransition } from "react";
import { renameHandleAction } from "@/app/actions";

// One-time custom rename. Renders only on your own profile and only while
// users.renamed_at is null. Successful submit redirects to /u/<new-handle>;
// the old URL 404s after that.
export function RenameHandle({ currentHandle }: { currentHandle: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setEditing(true);
          setError(null);
        }}
        className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-black/3 dark:hover:bg-white/5"
        title="Pick a custom handle — you can only do this once"
      >
        Pick a custom handle
      </button>
    );
  }

  function onSubmit() {
    setError(null);
    const next = value.trim().toLowerCase();
    if (!next) {
      setError("Type a new handle.");
      return;
    }
    startTransition(async () => {
      try {
        // Throws into the catch; on success it redirects so this never returns.
        await renameHandleAction(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Rename failed");
      }
    });
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-[var(--muted)]">@</span>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`new handle (current: ${currentHandle})`}
          maxLength={31}
          pattern="[a-z][a-z0-9-]{2,30}"
          disabled={pending}
          className="flex-1 rounded-md border border-[var(--border)] bg-transparent px-2 py-1 font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
        />
      </div>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      <p className="text-[10px] text-[var(--muted)]">
        a–z, 0–9, dash. Must start with a letter. One-time only — choose carefully.
      </p>
      <div className="flex justify-end gap-2 text-xs">
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setValue("");
            setError(null);
          }}
          disabled={pending}
          className="rounded-md border border-[var(--border)] px-3 py-1 hover:bg-black/3 dark:hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="rounded-md bg-[var(--accent)] px-3 py-1 text-white disabled:opacity-50"
        >
          {pending ? "Renaming…" : "Rename"}
        </button>
      </div>
    </div>
  );
}
