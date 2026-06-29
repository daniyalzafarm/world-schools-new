# World Schools

An Nx monorepo for the World Schools platform: a booking marketplace for school
camps, the provider portal that runs them, a super-admin back office, and the
NestJS API that powers all three.

## Tech stack

- **Monorepo:** Nx 22
- **Frontend:** Next.js 16, React 19, Tailwind CSS v4, HeroUI
- **Backend:** NestJS 11, Passport.js (JWT + local), Helmet, Socket.io
- **Database:** PostgreSQL via Prisma 7 (`@prisma/adapter-pg`)
- **Cache / pub-sub:** Redis (ioredis, `@socket.io/redis-adapter`)
- **Storage:** Azure Blob Storage
- **Payments:** Stripe (Connect, payment intents, webhooks)
- **Testing:** Jest (NestJS), Vitest (React/Next.js)
- **Package manager:** npm (Node `>=20.9 <21`)

## Applications

| App             | Type    | Dev port | Description                       |
| --------------- | ------- | -------- | --------------------------------- |
| `wc-booking`    | Next.js | 4303     | Booking frontend for parents      |
| `wc-provider`   | Next.js | 4302     | Provider portal                   |
| `wc-superadmin` | Next.js | 4301     | Super-admin dashboard             |
| `wc-nest-api`   | NestJS  | 3000     | Backend API for the above three   |

The repo also contains a separate `schoolable-web` / `schoolable-nest-api`
product; the setup below covers the World Schools (`wc-*`) apps.

## Shared packages

| Package                                       | Description                                          |
| --------------------------------------------- | ---------------------------------------------------- |
| `global-utils`                                | Cross-product utilities                              |
| `ui-web`                                      | Shared React UI component library                    |
| `wc-types` / `wc-utils` / `wc-frontend-utils` | World Schools types, server utils, frontend utils    |
| `wc-email-templates`                          | Transactional email templates                        |

## Prerequisites

- Node.js `>=20.9 <21` and npm
- PostgreSQL 14+
- Redis 6+
- An Azure Blob Storage account (file uploads) and Stripe account (payments) for
  full functionality

## Getting started

```bash
# 1. Install dependencies (from the repo root)
npm install

# 2. Configure environment for each app you want to run
cp apps/wc-nest-api/.env.example   apps/wc-nest-api/.env
cp apps/wc-booking/.env.example    apps/wc-booking/.env
cp apps/wc-provider/.env.example   apps/wc-provider/.env
cp apps/wc-superadmin/.env.example apps/wc-superadmin/.env
# then edit each .env with your DB, Redis, Azure and Stripe values

# 3. Set up the database (API)
npx nx prisma:generate wc-nest-api
npx nx prisma:migrate wc-nest-api
npx nx prisma:seed wc-nest-api

# 4. Run the apps (one per terminal)
npx nx serve wc-nest-api     # http://localhost:3000  (Swagger at /docs)
npx nx dev   wc-booking      # http://localhost:4303
npx nx dev   wc-provider     # http://localhost:4302
npx nx dev   wc-superadmin   # http://localhost:4301
```

After seeding, a default super-admin is available — see
[apps/wc-nest-api/README.md](apps/wc-nest-api/README.md) for the credentials and
API details. **Change the seeded credentials before deploying.**

## Common commands

```bash
# Dev servers
npx nx serve wc-nest-api
npx nx dev <wc-booking | wc-provider | wc-superadmin>

# Build / test / lint a single project
npx nx build <project>
npx nx test  <project>
npx nx lint  <project> --fix

# Across the workspace
npx nx run-many -t build --all
npx nx affected -t test
npx nx affected -t lint

# Prisma (wc-nest-api)
npx nx prisma:generate wc-nest-api    # regenerate client after schema changes
npx nx prisma:migrate  wc-nest-api    # create + apply a dev migration
npx nx prisma:seed     wc-nest-api    # seed initial data
npx nx prisma:studio   wc-nest-api    # open Prisma Studio

# Dependency graph
npx nx graph
```

Each `wc-*` app also has its own README with app-specific details, and the API
README documents auth, RBAC and the database schema.

## Deployment

CI/CD is GitHub Actions → Azure Container Apps. The staging workflow builds and
deploys on every `wc-v*.*.*` tag; the production workflow promotes the same
images by digest. See [DEPLOYMENT.md](DEPLOYMENT.md) for infrastructure, the
GitHub secrets/variables to configure, and the release flow.

## Known gaps

Areas that are intentionally stubbed or unfinished (marked with `// TODO:` in the
code), worth knowing before extending the platform:

- **Account verification** — email and SMS verification endpoints, plus
  password-reset email delivery, are stubbed in the API auth modules and need a
  real email/SMS provider wired in.
- **Privacy settings** — the "delete account" / "export data" actions on the
  account → settings → privacy pages (all three frontends) are UI-only and not yet
  connected to backend endpoints.
- **Abandonment & report notifications** — the booking abandon-detection cron and
  the messaging report flow currently log placeholders instead of dispatching
  notifications.
- **Misc** — child photo upload (booking) and exposing `User.createdAt` from the
  API are not yet implemented.

## License

MIT
