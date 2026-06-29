# wc-superadmin

The World Schools **super-admin dashboard** — the platform back office for
reviewing provider applications, managing providers/roles, overseeing billing,
disputes, reimbursements and payouts, and running bulk imports. Next.js 16 (App
Router) + React 19 + Tailwind v4 + HeroUI, talking to
[`wc-nest-api`](../wc-nest-api/README.md).

## Prerequisites

- The monorepo dependencies installed (`npm install` at the repo root)
- A running `wc-nest-api` instance (default `http://localhost:3000`)

## Setup

```bash
cp apps/wc-superadmin/.env.example apps/wc-superadmin/.env
# edit .env: API_BASE_URL, WS_URL,
#            PROVIDER_APP_URL / BOOKING_APP_URL (cross-app links), …
```

Runtime config is read on the server at request time and injected into
`window.__APP_CONFIG__` — env vars are **not** baked into the build, so no
`NEXT_PUBLIC_*` prefixes. See `.env.example` for the full list.

## Run

```bash
npx nx dev   wc-superadmin     # dev server → http://localhost:4301
npx nx build wc-superadmin     # production build
npx nx start wc-superadmin     # serve the production build
```

## Test / lint

```bash
npx nx test wc-superadmin          # Vitest
npx nx lint wc-superadmin --fix
```

## Notes

- Shared UI lives in [`ui-web`](../../packages/ui-web); shared frontend logic in
  [`wc-frontend-utils`](../../packages/wc-frontend-utils).
- Access is gated by role/permission (RBAC); the super-admin account is created by
  the API seed — see the [API README](../wc-nest-api/README.md).
- Billing, disputes and payout actions are server-authoritative; this app is the
  operator UI over the API's superadmin endpoints.
