<p align="center">
  <img src="./public/logo.png" alt="Thinking Outside the Box logo" width="200" />
</p>

# Thinking Outside the Box

> **Anonymously Think in Public. See How Many Think Like You.**

A platform where people chat with AI in public, and the system surfaces other users currently — or recently — exploring similar topics.

Most AI conversations happen behind a login wall. This makes them visible by default, clusters them by topic, and connects the strangers who are thinking about the same thing right now.

**Live**: https://thinking-outside-the-box.onrender.com

**Free. Open source. Donation-funded.** Target running cost under $20/month while small.

---

## How it works

- Open the site, pass an invisible [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) check, get an auto-generated handle (`curious-otter-42`-style). No email, no password, no account screen.
- Identity lives in a signed cookie on your device. Switch devices or clear cookies and you start fresh — by design.
- Send a message. As you chat, embeddings + tags surface other users exploring similar topics, live and from the last 24 hours.
- Default visibility is public. A one-click toggle flips it to unlisted (link-only).

## Features

- **Public AI chat** with Claude Sonnet 4.6, streaming responses, anyone can continue any public chat.
- **Real-time topic matching** via Voyage AI embeddings + pgvector — sidebar shows "X people are exploring something similar" live + last 24h.
- **Discovery hub** at `/` — Trending / Live / Following tabs with trending tags + recent public chats.
- **Unified search** (keyword via Postgres FTS + semantic via embeddings) at `/search` and `/feed?q=…`.
- **Profiles + follows** at `/u/<handle>` — follow users, follow topic tags, personalized Following tab.
- **Anonymous-by-design identity** — signed cookie, no email, no IP storage. `/delete-me` self-service erasure with ghost-user pattern.
- **Auto-moderation** via Claude Haiku 4.5 classifier; auto-files reports above threshold. Admin queue at `/reports`.
- **Self-hosted analytics** at `/insights` (admin) — DAU/WAU/MAU, event funnel, top tags, today's Anthropic spend.
- **Anthropic spend kill-switch** — daily USD cap, refuses new chats with HTTP 429 until UTC midnight when exceeded.
- **Full security baseline** — CSP, HSTS, signed cookies, PII redaction, rate limits, Turnstile gate, Dependabot + gitleaks CI.

## Tech stack

- **Next.js 16** (App Router, Turbopack)
- **Supabase** (Postgres + pgvector + Realtime broadcast)
- **Anthropic Claude** (Sonnet 4.6 for chat, Haiku 4.5 for moderation/tagging)
- **Voyage AI** (semantic embeddings)
- **Cloudflare Turnstile** (invisible human check)
- **Sentry** (error monitoring, no PII / no session replay)
- **Render** (Node web service hosting, Starter tier — no cold starts)

## Run it locally

You'll need Node 20+, a Supabase project, and either a local MLX server or an Anthropic API key.

```bash
git clone https://github.com/qwertykeypadapple/thinking-outside-the-box.git
cd thinking-outside-the-box

# Copy the env template and fill in your keys
cp .env.example .env.local

# Apply the 17 SQL migrations in supabase/migrations/*.sql via
# Supabase Dashboard → SQL Editor (in numerical order).

npm install
npm run dev
```

Open http://localhost:3000.

### Required env vars (minimum)

| Variable | Purpose |
|---|---|
| `COOKIE_SECRET` | HMAC key for signed identity cookies (≥32 chars) |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase key (`sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | Server-only Supabase key (`sb_secret_…`, never expose) |
| `LLM_PROVIDER` | `mlx` (local) or `anthropic` |

See [`.env.example`](./.env.example) for the full list — Sentry, Turnstile, embeddings, moderation, kill-switch, and donation channel URLs. Everything optional soft-disables when its env vars are unset, so you can start with just the five above.

## Project layout

```
src/
  app/
    api/chat/           LLM streaming route handler
    api/turnstile/      human-check token verifier
    c/[chatId]/         individual chat page
    feed/               public feed + unified search
    search/             standalone search surface
    sponsors/           donation channels
    costs/              transparent operating costs
    insights/           admin analytics (gated by ADMIN_HANDLE)
    reports/            moderation queue (gated by ADMIN_HANDLE)
    u/[handle]/         user profile + /delete-me erasure
    mint/               first-visit cookie minting (replaces middleware)
    deleted/            post-erasure landing
    health/             dirt-cheap 200 for Render LB
    opengraph-image.tsx dynamic 1200×630 OG image
    icon.png            favicon (the brand logo)
    apple-icon.png      iOS home-screen icon
  components/           shared UI (chat-view, chat-card, brand-mark, …)
  lib/
    chat/               chat + match domain
    embeddings/         Voyage AI wrapper
    identity/           signed cookies (totb_id + totb_human)
    llm/                provider abstraction + moderator + usage
    pii/                redaction
    rate-limit/         per-handle hour + day buckets
    turnstile/          server-side siteverify
    users/              profile + follow domain
    analytics/          event capture + spend rollups
    reports/            moderation queue
  instrumentation.ts          Sentry server + edge init
  instrumentation-client.ts   Sentry browser init
supabase/migrations/    17 numbered SQL files — apply in order
```

## Contributing

Issues and PRs welcome. Two non-negotiables shape every decision:

1. **No PII columns by design.** Identity is a signed cookie. No email, no password, no IP storage, no third-party trackers. Changes that conflict need explicit discussion in an issue first.
2. **Cost discipline** — target running cost <$20/month. Features that meaningfully increase Anthropic spend or add paid infra deps need to come with a corresponding kill-switch or fallback path.

Beyond those: it's an early-stage solo project. Bug fixes and small features ship fast. Larger features — open an issue describing the change before writing code.

## Funding

Two complementary channels, both **pending approval** at launch:

- **[GitHub Sponsors](https://github.com/sponsors/qwertykeypadapple)** — best for individual devs giving recurring small amounts. 0% platform fee.
- **[Open Collective](https://opencollective.com/)** (via [Open Source Collective](https://www.oscollective.org/) fiscal host) — tax-deductible receipts via 501(c)(3) status, public budget. 10% fiscal-host fee. Best for company sponsors + larger donations.

Nothing is paywalled and nothing will be. Donations cover Anthropic API + Render hosting. The [`/costs`](https://thinking-outside-the-box.onrender.com/costs) page shows the live budget. The [`/sponsors`](https://thinking-outside-the-box.onrender.com/sponsors) page shows both donation channels.

## License

[MIT](./LICENSE) — qwertykeypadapple and contributors.
