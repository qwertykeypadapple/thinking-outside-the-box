import { NextResponse } from "next/server";

export const runtime = "nodejs";
// force-static is the cheapest possible Route Handler — no per-request work,
// pure 200 OK. Render's load-balancer health check pings this; if we hit
// Supabase here we'd waste a connection on every probe.
export const dynamic = "force-static";

// Liveness probe. Returns 200 if the Node process is running. NOT a readiness
// probe — does not check Supabase, Anthropic, or any downstream. That's
// deliberate: a downstream outage shouldn't make Render restart the service
// (Render would just spin up a fresh container that also can't reach the
// downstream, and we'd loop). For readiness, add a separate /ready route
// later that does check dependencies.
export function GET() {
  return NextResponse.json({ ok: true });
}
