"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Renders nothing. Subscribes to the matching pool over Supabase Realtime
// and triggers a soft server refresh when public chats change — server
// recomputes findSimilarChats / -ByEmbedding and the SimilarStrip updates
// in place.
//
// Two debounce knobs:
//   - REFRESH_DEBOUNCE_MS: how long to wait for more events before refreshing.
//     Short = snappier "live" feel; longer = fewer redundant renders when a
//     batch of rows flip at once.
//   - MIN_INTERVAL_MS: hard floor between consecutive refreshes so a chatty
//     channel can't pin the page in a refresh loop.

const REFRESH_DEBOUNCE_MS = 600;
const MIN_INTERVAL_MS = 1200;

export function RealtimeMatchTrigger() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshAtRef = useRef<number>(0);

  useEffect(() => {
    const sb = createSupabaseBrowserClient();

    function fireRefresh() {
      timerRef.current = null;
      lastRefreshAtRef.current = Date.now();
      router.refresh();
    }

    function scheduleRefresh() {
      if (timerRef.current) clearTimeout(timerRef.current);
      const sinceLast = Date.now() - lastRefreshAtRef.current;
      const delay = Math.max(REFRESH_DEBOUNCE_MS, MIN_INTERVAL_MS - sinceLast);
      timerRef.current = setTimeout(fireRefresh, delay);
    }

    const channel = sb
      .channel("matching-pool")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chats" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chats" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chats" },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void sb.removeChannel(channel);
    };
  }, [router]);

  return null;
}
