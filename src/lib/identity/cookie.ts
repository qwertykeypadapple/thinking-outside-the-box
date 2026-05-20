// Web Crypto–only so this module loads in both Edge (middleware) and Node (route handlers).
import { cookies } from "next/headers";
import { generateHandle, isValidHandle } from "./handle";

export const COOKIE_NAME = "totb_id";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export type Identity = { handle: string; isNew: boolean };

function getSecret(): string {
  const s = process.env.COOKIE_SECRET;
  if (!s || s.length < 32) {
    throw new Error("COOKIE_SECRET must be set (>=32 chars) in env");
  }
  return s;
}

function toBase64Url(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  // Allocate a concrete ArrayBuffer (not SharedArrayBuffer) so the resulting
  // view satisfies BufferSource on TS lib targets that distinguish them.
  const u8 = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

// importKey() is non-trivial on the Web Crypto path — caching the CryptoKey
// in module scope is the difference between ~ms HMAC ops and 100ms+ stalls
// when called per-request (proxy + page = 2 HMAC ops on every nav).
let cachedKey: Promise<CryptoKey> | null = null;
function importKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    cachedKey = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(getSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  return cachedKey;
}

async function sign(value: string): Promise<string> {
  const key = await importKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toBase64Url(sig);
}

async function verify(value: string, signature: string): Promise<boolean> {
  try {
    const key = await importKey();
    return await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature),
      new TextEncoder().encode(value),
    );
  } catch {
    return false;
  }
}

export async function encodeIdentity(handle: string): Promise<string> {
  return `${handle}.${await sign(handle)}`;
}

export async function decodeIdentity(raw: string | undefined | null): Promise<string | null> {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const handle = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!isValidHandle(handle)) return null;
  return (await verify(handle, sig)) ? handle : null;
}

// Read-only. Safe to call from Server Components (page.tsx).
// Middleware guarantees the cookie is set on every request, so this returns non-null
// for any normal request that came through middleware.
export async function getIdentity(): Promise<Identity | null> {
  const jar = await cookies();
  const handle = await decodeIdentity(jar.get(COOKIE_NAME)?.value);
  return handle ? { handle, isNew: false } : null;
}

// Read + write. Only callable from Route Handlers / Server Actions (Next.js restriction).
// Kept as a fallback for endpoints that didn't pass through middleware.
export async function getOrCreateIdentity(): Promise<Identity> {
  const jar = await cookies();
  const existing = await decodeIdentity(jar.get(COOKIE_NAME)?.value);
  if (existing) return { handle: existing, isNew: false };

  const handle = generateHandle();
  jar.set(COOKIE_NAME, await encodeIdentity(handle), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return { handle, isNew: true };
}
