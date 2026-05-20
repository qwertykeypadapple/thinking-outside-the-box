"use client";

import { useState, useTransition } from "react";
import { updateBioAction } from "@/app/actions";

const MAX_LEN = 280;

export function EditBio({ handle, initialBio }: { handle: string; initialBio: string }) {
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(initialBio);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm">
          {bio ? bio : <span className="italic text-[var(--muted)]">No bio yet.</span>}
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-black/3 dark:hover:bg-white/5"
        >
          Edit
        </button>
      </div>
    );
  }

  function onSave() {
    setError(null);
    const trimmed = bio.trim();
    if (trimmed.length > MAX_LEN) {
      setError(`Bio must be ${MAX_LEN} characters or fewer.`);
      return;
    }
    startTransition(async () => {
      try {
        await updateBioAction(handle, trimmed);
        setBio(trimmed);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "save failed");
      }
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        maxLength={MAX_LEN}
        rows={3}
        disabled={pending}
        placeholder="A line about how you think out loud."
        className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
      />
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-[var(--muted)]">{bio.length} / {MAX_LEN}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setBio(initialBio);
              setEditing(false);
              setError(null);
            }}
            disabled={pending}
            className="rounded-md border border-[var(--border)] px-3 py-1 hover:bg-black/3 disabled:opacity-40 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="rounded-md bg-[var(--accent)] px-3 py-1 text-white disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
