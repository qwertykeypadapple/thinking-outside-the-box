"use client";

import { useState, useTransition } from "react";
import { toggleFollowAction } from "@/app/actions";

export function FollowButton({
  targetHandle,
  initialFollowing,
}: {
  targetHandle: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  function onClick() {
    const prev = following;
    setFollowing(!prev); // optimistic
    startTransition(async () => {
      try {
        const result = await toggleFollowAction(targetHandle);
        setFollowing(result.following);
      } catch {
        setFollowing(prev);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={
        "rounded-md px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 " +
        (following
          ? "border border-[var(--border)] text-[var(--muted)] hover:border-red-400 hover:text-red-500"
          : "bg-[var(--accent)] text-white hover:opacity-90")
      }
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
