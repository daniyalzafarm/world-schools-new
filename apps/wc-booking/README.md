# wc-booking

The World Schools **booking frontend** — where parents discover camps, manage
children, and book and pay for sessions. Next.js 16 (App Router) + React 19 +
Tailwind v4 + HeroUI, talking to [`wc-nest-api`](../wc-nest-api/README.md).

## Prerequisites

- The monorepo dependencies installed (`npm install` at the repo root)
- A running `wc-nest-api` instance (default `http://localhost:3000`)

## Setup

```bash
cp apps/wc-booking/.env.example apps/wc-booking/.env
# edit .env: API_BASE_URL, WS_URL, STRIPE_PUBLISHABLE_KEY, GOOGLE_MAPS_API_KEY, …
```

Runtime config is read on the server at request time and injected into
`window.__APP_CONFIG__` — env vars are **not** baked into the build, so no
`NEXT_PUBLIC_*` prefixes. See `.env.example` for the full list.

## Run

```bash
npx nx dev   wc-booking     # dev server → http://localhost:4303
npx nx build wc-booking     # production build
npx nx start wc-booking     # serve the production build
```

## Test / lint

```bash
npx nx test wc-booking          # Vitest
npx nx lint wc-booking --fix
```

## Notes

- Shared UI lives in [`ui-web`](../../packages/ui-web); shared frontend logic and
  the messaging/notifications stores in
  [`wc-frontend-utils`](../../packages/wc-frontend-utils).
- Real-time messaging uses Socket.io against the API's WebSocket gateway
  (`WS_URL`), with an HTTP fallback flag.
- Payments use Stripe.js with the publishable key; the secret-side flow lives in
  the API.
