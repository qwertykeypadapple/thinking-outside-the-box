import { NextRequest } from "next/server";
import { setHumanVerified } from "@/lib/identity/human-cookie";
import { verifyTurnstileToken } from "@/lib/turnstile/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Browser POSTs the Turnstile token here after the widget produces it. On
// success we set the totb_human cookie (24h) and the chat route stops
// returning 403 on /api/chat.
export async function POST(req: NextRequest) {
  let body: { token?: unknown };
  try {
    body = (await req.json()) as { token?: unknown };
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : null;
  // Forward client IP for siteverify so Cloudflare can correlate with their
  // own bot scoring. Render puts the real IP in x-forwarded-for; first hop is
  // closest to the client.
  const fwd = req.headers.get("x-forwarded-for");
  const clientIp = fwd ? fwd.split(",")[0]?.trim() ?? null : null;

  const verdict = await verifyTurnstileToken(token, clientIp);
  if (!verdict.ok) {
    return Response.json({ ok: false, reason: verdict.reason }, { status: 403 });
  }

  await setHumanVerified();
  return Response.json({ ok: true, disabled: verdict.disabled });
}
