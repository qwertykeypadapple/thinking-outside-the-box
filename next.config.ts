import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Security headers — Section 8.1 of PLAN.md.
// CSP is conservative in production but loosened in development because
// Turbopack's HMR client uses inline scripts + eval. The dev relaxation only
// applies when NODE_ENV !== "production".
const isProd = process.env.NODE_ENV === "production";

// Sentry endpoints: the browser SDK posts events to <org>.ingest.<region>.sentry.io.
// We also tunnel through /monitoring (see withSentryConfig below), but allow the
// direct host defensively for any SDK path that bypasses the tunnel.
const sentryConnectSrc = "https://*.sentry.io https://*.ingest.sentry.io";

const cspProd = [
  "default-src 'self'",
  // Next + Turbopack require some inline; allow nonce-less inline for now.
  // Tighten with a nonce middleware when you add real third-party scripts.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.voyageai.com https://api.anthropic.com ${sentryConnectSrc}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const cspDev = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ws: http://localhost:* https://*.supabase.co wss://*.supabase.co https://api.voyageai.com https://api.anthropic.com ${sentryConnectSrc}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: isProd ? cspProd : cspDev },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // HSTS only in prod (dev runs HTTP; setting HSTS in dev breaks future http://localhost loads).
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

// withSentryConfig — only meaningfully active when SENTRY_AUTH_TOKEN is set
// at build time (uploads source maps). Without the token, the wrapper still
// adds the runtime SDK + creates the /monitoring tunnel route, which is what
// we want. org/project resolved at build time from env vars so the values
// don't have to be hardcoded for a public OSS repo.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload a wider set of client source files so production stack traces
  // resolve to readable file:line locations in the Sentry UI.
  widenClientFileUpload: true,

  // Proxy SDK events through this app's own domain to dodge ad-blockers
  // that block direct sentry.io requests. proxy.ts excludes this path.
  tunnelRoute: "/monitoring",

  // Silence the build output noise unless we're in CI.
  silent: !process.env.CI,

  // NOTE: webpack tree-shake options intentionally omitted — this project
  // uses Turbopack, where they have no effect (skill troubleshooting note).
});
