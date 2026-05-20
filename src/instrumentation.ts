// Next 16 instrumentation hook (renamed from middleware-era patterns).
// register() runs once when each server runtime boots; we use it to load the
// runtime-specific Sentry init via dynamic import so the Edge bundle never
// pulls in the Node SDK and vice versa.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Catches unhandled server-side request errors (server actions, route
// handlers, RSC render errors) and reports them with full request context.
// Requires @sentry/nextjs >= 8.28.0.
export const onRequestError = Sentry.captureRequestError;
