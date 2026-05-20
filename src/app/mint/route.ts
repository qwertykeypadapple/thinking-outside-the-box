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

  const dest = new URL(to, req.url);
  // Tell the destination it's a fresh mint so chat-view can render the
  // "your handle lives on this device only" first-visit notice. Returning
  // visitors (cookie already present) skip the flag entirely.
  if (isNew) dest.searchParams.set("welcome", "1");

  return NextResponse.redirect(dest);
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
