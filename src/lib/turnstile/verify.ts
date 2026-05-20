// Cloudflare Turnstile server-side token verification.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
//
// Soft-disabled when TURNSTILE_SECRET_KEY is unset so local dev and CI work
// without Cloudflare setup. In that mode every token "verifies" — DO NOT
// rely on this for security in any environment that has the env var set.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileVerdict =
  | { ok: true; disabled: boolean }
  | { ok: false; reason: string };

export function isTurnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileVerdict> {
  if (!isTurnstileEnabled()) {
    // Dev path: pretend everything is human. The widget itself uses Cloudflare's
    // always-pass test sitekey, which produces the literal token "XXXX.DUMMY.TOKEN.XXXX"
    // — verification would succeed against the always-pass secret too, but we
    // short-circuit so devs don't need to install network mocks.
    return { ok: true, disabled: true };
  }

  if (!token) return { ok: false, reason: "missing token" };

  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY as string,
    response: token,
  });
  if (remoteIp) body.set("remoteip", remoteIp);

  let res: Response;
  try {
    res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      // Short timeout — Cloudflare's siteverify is reliably fast; if it's
      // slow the user shouldn't wait long for a "complete verification" error.
      signal: AbortSignal.timeout(5_000),
    });
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "fetch failed" };
  }

  if (!res.ok) return { ok: false, reason: `siteverify http ${res.status}` };

  const data = (await res.json().catch(() => null)) as
    | { success?: boolean; "error-codes"?: string[] }
    | null;
  if (!data) return { ok: false, reason: "siteverify returned invalid json" };
  if (!data.success) {
    return { ok: false, reason: (data["error-codes"] ?? ["unknown"]).join(",") };
  }
  return { ok: true, disabled: false };
}
