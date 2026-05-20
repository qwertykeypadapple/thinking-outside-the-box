// Sentry — Node.js (server route + server action) runtime init.
// Loaded by instrumentation.ts when NEXT_RUNTIME === "nodejs".
// No-op when SENTRY_DSN is unset so dev/CI work without a Sentry account.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Privacy stance (PLAN §8.4): explicitly disable PII + local-variable capture.
    // Defaults would attach IPs, request headers, and the raw values of locals
    // like `userText` before redaction — which would defeat redact() entirely.
    sendDefaultPii: false,
    includeLocalVariables: false,
    // 10% of transactions traced in prod; 100% in dev for fast feedback when
    // tuning. Keeps free-tier quota intact at small scale.
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    enableLogs: false,
  });
}
