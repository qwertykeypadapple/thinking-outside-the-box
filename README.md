<p align="center">
  <img src="./public/logo.png" alt="Thinking Outside the Box logo" width="200" />
</p>

# Thinking Outside the Box

> **Anonymously Think in Public. Find Your People.**

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

## Tech stack

- **Next.js 16** (App Router, Turbopack)
- **Supabase** (Postgres + pgvector + Realtime broadcast)
- **Anthropic Claude** (Sonnet 4.6 for chat, Haiku 4.5 for moderation/tagging)
- **Voyage AI** (semantic embeddings)
- **Cloudflare Turnstile** (invisible human check)
- **Sentry** (error monitoring, no PII / no session replay)
- **Render** (web service hosting)

## Run it locally

You'll need Node 20+, a Supabase project, and either a local MLX server or an Anthropic API key.

```bash
git clone https://github.com/qwertykeypadapple/thinking-outside-the-box.git
cd thinking-outside-the-box

# Copy the env template and fill in your keys
cp .env.example .env.local

# Apply the SQL migrations in supabase/migrations/*.sql via
# Supabase Dashboard → SQL Editor (in order).

npm install
npm run dev
```

Open http://localhost:3000.

### Required env vars (minimum)

| Variable | Purpose |
|---|---|
| `COOKIE_SECRET` | HMAC key for signed identity cookies (≥32 chars) |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase key |
| `SUPABASE_SECRET_KEY` | Server-only Supabase key (never expose) |
| `LLM_PROVIDER` | `mlx` (local) or `anthropic` |

See [`.env.example`](./.env.example) for the full list, including Sentry, Turnstile, embeddings, and moderation knobs. Everything optional soft-disables when its env vars are unset.

## Project layout

```
src/
  app/                  routes + server actions (App Router)
    api/chat/           LLM streaming route handler
    c/[chatId]/         individual chat page
    feed/               public feed + unified search
    insights/           admin analytics (gated by ADMIN_HANDLE)
    reports/            moderation queue (gated by ADMIN_HANDLE)
    u/[handle]/         user profile + one-time handle rename
  components/           shared UI (chat-view, turnstile-widget, etc.)
  lib/                  domain logic (identity, llm, embeddings, moderator, …)
  proxy.ts              Next 16 middleware — mints the identity cookie
  instrumentation.ts    Sentry server + edge init
  instrumentation-client.ts  Sentry browser init
supabase/migrations/    SQL migrations — apply in numbered order
```

## Contributing

Issues and PRs are welcome. The project is structured around a strict privacy stance — no PII columns, no session replay, no chat content leaves the platform. Changes that conflict with that need explicit discussion in an issue first.

## Funding

This project is donation-funded via [GitHub Sponsors](https://github.com/sponsors). Nothing is paywalled and nothing ever will be. Donations cover Anthropic API costs + hosting. The `/costs` page on the live site shows actual spend.

## License

[MIT](./LICENSE) — qwertykeypadapple and contributors.
