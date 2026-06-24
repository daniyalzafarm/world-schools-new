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

| App                   | Type    | Description                            |
| --------------------- | ------- | -------------------------------------- |
| `wc-booking`          | Next.js | World Camps booking frontend           |
| `wc-provider`         | Next.js | World Camps provider portal            |
| `wc-superadmin`       | Next.js | World Camps super admin dashboard      |
| `wc-nest-api`         | NestJS  | World Camps backend API                |
| `schoolable-nest-api` | NestJS  | Backend API for the Schoolable product |
| `schoolable-web`      | Next.js | Frontend for the Schoolable product    |

## Shared Packages

| Package                                       | Description                                             |
| --------------------------------------------- | ------------------------------------------------------- |
| `global-utils`                                | Cross-product utilities                                 |
| `ui-web`                                      | Shared React UI component library                       |
| `wc-types` / `wc-utils` / `wc-frontend-utils` | World Camps types, server utils, and frontend utilities |
| `schoolable-types` / `schoolable-utils`       | Schoolable domain types and server utilities            |

## GuideLines

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```text
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

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

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
