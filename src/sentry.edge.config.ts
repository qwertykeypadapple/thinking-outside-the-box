// Sentry — Edge runtime init (Next 16 proxy / middleware).
// Loaded by instrumentation.ts when NEXT_RUNTIME === "edge".
// Same DSN as server config — Sentry differentiates events by runtime tag.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    enableLogs: false,
  });
}
