import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  COOKIE_MAX_AGE,
  decodeIdentity,
  encodeIdentity,
} from "@/lib/identity/cookie";
import { generateHandle } from "@/lib/identity/handle";

// On every request that hits the app (not assets/api/_next), ensure a signed
// identity cookie is present. If missing or invalid, generate a fresh handle
// and set the cookie — done in proxy (Next.js 16's renamed middleware)
// because Server Components cannot write cookies.
export async function proxy(request: NextRequest) {
  const existing = request.cookies.get(COOKIE_NAME)?.value;
  const valid = await decodeIdentity(existing);
  if (valid) return NextResponse.next();

  const fresh = generateHandle();
  const encoded = await encodeIdentity(fresh);

  // Make the cookie + "isNew" hint visible to the downstream page via request headers.
  request.cookies.set(COOKIE_NAME, encoded);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-handle-new", "1");

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Persist on the browser for future requests.
  response.cookies.set(COOKIE_NAME, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}

export const config = {
  matcher: [
    // Run on everything except Next internals, static files, the favicon,
    // and the Sentry tunnel route (browser SDK POSTs events to /monitoring
    // — minting an identity cookie or 307'ing would break the ingest path).
    "/((?!monitoring|_next/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
