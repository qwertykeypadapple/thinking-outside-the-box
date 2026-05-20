import { NextRequest, NextResponse } from "next/server";
import { getOrCreateIdentity } from "@/lib/identity/cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// First-visit identity minting. Server Components can read cookies but not
// write them, so pages that need identity bounce through here. This route
// IS a Route Handler, which can set cookies — the cookie write happens
// inside getOrCreateIdentity().
//
// Replaces the cookie-minting half of the old proxy.ts. Necessary because
// Next 16's renamed-from-middleware "proxy" defaults to the Node.js runtime
// and that's incompatible with OpenNext's Cloudflare adapter.
export async function GET(req: NextRequest) {
  const { isNew } = await getOrCreateIdentity();

  const rawTo = req.nextUrl.searchParams.get("to") ?? "/";
  const to = sanitizeRedirectPath(rawTo);

  // Build the public origin from forwarded headers. req.url and even
  // req.nextUrl.origin in Next 16 reflect the Node server's bind address
  // (http://0.0.0.0:10000 on Render) — useless for the Location header
  // any external client receives. Render sets X-Forwarded-Host and
  // X-Forwarded-Proto on the proxy hop, so we read those explicitly.
  //
  // NEXT_PUBLIC_SITE_URL is a hard-override escape hatch if a future host
  // sets the forwarded headers differently. Falls back to req.url for
  // local dev where the bind host equals the public host (localhost:3000).
  const origin = resolvePublicOrigin(req);

  // Append the welcome flag on a fresh mint so chat-view shows the
  // "your handle lives on this device only" first-visit notice. Returning
  // visitors (cookie already present) skip the flag entirely.
  const path = isNew
    ? appendQuery(to, { welcome: "1" })
    : to;

  return NextResponse.redirect(new URL(path, origin));
}

function resolvePublicOrigin(req: NextRequest): string {
  // Hard override wins. Useful if someone deploys behind a reverse proxy
  // that doesn't set the standard forwarded headers.
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (envUrl) return envUrl;

  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? null;
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }

  // Last resort: req.url. In dev this is localhost:3000 which works.
  return new URL(req.url).origin;
}

function appendQuery(path: string, params: Record<string, string>): string {
  const [base, existing = ""] = path.split("?", 2);
  const sp = new URLSearchParams(existing);
  for (const [k, v] of Object.entries(params)) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

// Open-redirect defense: only accept same-origin relative paths. An attacker
// who could craft ?to=//evil.com/x or ?to=https://evil.com/x would redirect
// the visitor off-site post-mint; the cookie still gets set first, so this is
// also a "set our cookie, then bounce to phishing page" vector.
function sanitizeRedirectPath(raw: string): string {
  if (!raw.startsWith("/")) return "/";
  // Reject protocol-relative URLs like //evil.com/path which a naive new URL()
  // would resolve to a different host.
  if (raw.startsWith("//")) return "/";
  return raw;
}
