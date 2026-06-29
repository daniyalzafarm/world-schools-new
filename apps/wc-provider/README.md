# wc-provider

The World Schools **provider portal** — where camp providers onboard, manage
camps and sessions, handle booking requests, configure payment policies, and
connect Stripe for payouts. Next.js 16 (App Router) + React 19 + Tailwind v4 +
HeroUI, talking to [`wc-nest-api`](../wc-nest-api/README.md).

## Prerequisites

- The monorepo dependencies installed (`npm install` at the repo root)
- A running `wc-nest-api` instance (default `http://localhost:3000`)

## Setup

```bash
cp apps/wc-provider/.env.example apps/wc-provider/.env
# edit .env: API_BASE_URL, WS_URL, STRIPE_PUBLISHABLE_KEY,
#            BOOKING_APP_URL / SUPERADMIN_APP_URL (cross-app links), …
```

Runtime config is read on the server at request time and injected into
`window.__APP_CONFIG__` — env vars are **not** baked into the build, so no
`NEXT_PUBLIC_*` prefixes. See `.env.example` for the full list.

## Run

```bash
npx nx dev   wc-provider     # dev server → http://localhost:4302
npx nx build wc-provider     # production build
npx nx start wc-provider     # serve the production build
```

## Test / lint

```bash
npx nx test wc-provider          # Vitest
npx nx lint wc-provider --fix
```

## Notes

- Shared UI lives in [`ui-web`](../../packages/ui-web); shared frontend logic in
  [`wc-frontend-utils`](../../packages/wc-frontend-utils).
- Provider onboarding includes a Stripe Connect flow; the account/payout logic is
  handled server-side in the API.
- Real-time messaging and booking-request updates use Socket.io against the API's
  WebSocket gateway (`WS_URL`).
