// Sentry — browser runtime init. Next 16 picks this file up automatically
// for the client bundle (replaces the older sentry.client.config.ts pattern).
// No-op when NEXT_PUBLIC_SENTRY_DSN is unset so dev/CI work without a Sentry
// account. Explicitly skips Session Replay — replay would record on-screen
// chat content, which violates the PLAN §8.4 "no chat content leaves the
// platform" stance even when public chats are involved.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    enableLogs: false,
    // No replayIntegration — see comment above.
  });
}

// Reports App Router navigation transitions so client-side route changes
// show up as spans in Sentry. Cheap; safe to keep even when DSN is unset
// (the SDK no-ops when not initialized).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
