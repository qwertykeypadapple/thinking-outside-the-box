// HMAC-signed "human-verified" cookie. Set by /api/turnstile/verify after a
// successful Cloudflare Turnstile check; consumed by /api/chat to gate the
// LLM call. 24h TTL — matches PLAN §2.1's "re-verified once per session
// (≈ once per calendar day)" guidance.
//
// Same crypto pattern as the identity cookie (lib/identity/cookie.ts): the
// payload is a base64url timestamp, signed with COOKIE_SECRET. We reuse the
// existing secret rather than introducing a new one to keep ops simple.

import { cookies } from "next/headers";
import { isTurnstileEnabled } from "@/lib/turnstile/verify";

export const HUMAN_COOKIE_NAME = "totb_human";
export const HUMAN_COOKIE_MAX_AGE = 24 * 60 * 60; // 24h

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
  const u8 = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

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

// Cookie shape: "<unix-timestamp-ms>.<hmac>"
async function encodeHuman(): Promise<string> {
  const ts = Date.now().toString();
  return `${ts}.${await sign(ts)}`;
}

// Returns true if the cookie is present, validly signed, and not yet expired.
async function decodeHuman(raw: string | undefined | null): Promise<boolean> {
  if (!raw) return false;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return false;
  const ts = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!/^\d+$/.test(ts)) return false;
  if (!(await verify(ts, sig))) return false;
  const age = Date.now() - Number(ts);
  return age >= 0 && age < HUMAN_COOKIE_MAX_AGE * 1000;
}

// Server-side: read the cookie and tell the caller whether the visitor counts
// as human-verified. Soft-bypasses when Turnstile is disabled by env (dev/CI).
export async function isHumanVerified(): Promise<boolean> {
  if (!isTurnstileEnabled()) return true;
  const jar = await cookies();
  return decodeHuman(jar.get(HUMAN_COOKIE_NAME)?.value);
}

// Server-side: set the human cookie after a successful Turnstile verification.
// Only callable from Route Handlers / Server Actions (Next.js cookie write
// restriction).
export async function setHumanVerified(): Promise<void> {
  const jar = await cookies();
  jar.set(HUMAN_COOKIE_NAME, await encodeHuman(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: HUMAN_COOKIE_MAX_AGE,
    path: "/",
  });
}
