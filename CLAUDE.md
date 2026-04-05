# World Schools Monorepo

## Tech Stack
- **Monorepo**: Nx 22
- **Frontend**: Next.js 16, React 19, Tailwind CSS v4, HeroUI
- **Backend**: NestJS 11, Passport.js (JWT + local), Helmet, Socket.io (WebSockets)
- **Database**: PostgreSQL via Prisma 7 (`@prisma/adapter-pg`)
- **Cache / Pub-Sub**: Redis (ioredis, `@socket.io/redis-adapter`)
- **Storage**: Azure Blob Storage
- **Testing**: Jest (NestJS), Vitest (React/Next.js)
- **Package manager**: npm (node >=20.9 <21)

## Apps
| App | Type | Description |
|-----|------|-------------|
| `wc-booking` | Next.js | World Camps booking frontend |
| `wc-provider` | Vite/React | World Camps provider portal |
| `wc-superadmin` | Vite/React | World Camps super admin dashboard |
| `wc-nest-api` | NestJS | World Camps backend API |
| `schoolable-nest-api` | NestJS | Backend API for the Schoolable product |
| `schoolable-web` | Next.js | Frontend for the Schoolable product |

## Shared Packages
| Package | Description |
|---------|-------------|
| `global-utils` | Cross-product utilities |
| `ui-web` | Shared React UI component library |
| `wc-types` / `wc-utils` / `wc-frontend-utils` | World Camps types, server utils, and frontend utilities |
| `schoolable-types` / `schoolable-utils` | Schoolable domain types and server utilities |

## Key Commands
```bash
# Dev
npx nx dev wc-booking
npx nx dev wc-provider
npx nx dev wc-superadmin
npx nx serve wc-nest-api

# Build / test / lint
npx nx build <project>
npx nx test <project>
npx nx lint <project> --fix
npx nx lint wc # lint all wc-* projects with autofix
npx nx lint schoolable # lint all schoolable-* projects with autofix
npx nx run-many -t build --all
npx nx affected -t test

# Prisma Commands for wc-nest-api
npx nx prisma:generate wc-nest-api
npx nx prisma:migrate wc-nest-api
npx nx prisma:seed wc-nest-api
```

## Code Conventions
- TypeScript strict mode throughout
- NestJS: use class-validator DTOs for all inputs; never put business logic in controllers
- Frontend state: Zustand for global state
- Shared types live in `*-types` packages — never define domain types directly in apps
- Reusable UI components belong in `ui-web` if used across more than one product
- Real-time features use Socket.io with Redis adapter for multi-instance support

---

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors

# CI Error Guidelines

If the user wants help with fixing an error in their CI pipeline, use the following flow:
- Retrieve the list of current CI Pipeline Executions (CIPEs) using the `nx_cloud_cipe_details` tool
- If there are any errors, use the `nx_cloud_fix_cipe_failure` tool to retrieve the logs for a specific task
- Use the task logs to see what's wrong and help the user fix their problem. Use the appropriate tools if necessary
- Make sure that the problem is fixed by running the task that you passed into the `nx_cloud_fix_cipe_failure` tool


<!-- nx configuration end-->