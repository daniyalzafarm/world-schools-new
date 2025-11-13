# Prisma Configuration in This Monorepo

## Overview

This document explains how Prisma is configured in this Nx monorepo and the best practices for managing multiple Prisma instances across different applications.

## Current Setup

### Applications with Prisma

1. **`apps/wc-nest-api/`** - ✅ Fully configured with Prisma
   - Has `prisma/schema.prisma` (database schema)
   - Has `prisma/seed.ts` (database seeding script)
   - Has Prisma targets in `project.json` (generate, migrate, seed, studio, reset)
   - Connects to its own PostgreSQL database via `DATABASE_URL` in `.env`

2. **`apps/schoolable-nest-api/`** - ❌ No Prisma setup yet
   - Can be configured in the future following the same pattern as `wc-nest-api`

## Architecture Decision: No Global Prisma Configuration

### What Was Changed

**Removed** the global Prisma seed configuration from the root `package.json`:

```json
// ❌ REMOVED - This was problematic
"prisma": {
  "seed": "ts-node apps/wc-nest-api/prisma/seed.ts"
}
```

### Why This Change Was Made

1. **Multiple Independent Databases**
   - Each NestJS application connects to its own separate database
   - Each app has its own `DATABASE_URL` in its respective `.env` file
   - A global seed configuration only works for one app and causes confusion

2. **Nx Monorepo Best Practices**
   - In Nx monorepos, each application should manage its own configuration independently
   - Prisma operations should be scoped to specific applications using Nx targets
   - This provides better isolation and prevents cross-app interference

3. **Proper Nx Target Configuration**
   - Each app already has proper Prisma targets in its `project.json`
   - Running `nx prisma:seed wc-nest-api` works correctly without global config
   - The global config was redundant and could cause issues

4. **Scalability**
   - When `schoolable-nest-api` or other apps need Prisma, they can add their own targets
   - No conflicts or overwrites of global configuration
   - Each app remains independent and portable

## How to Use Prisma Commands

### For `wc-nest-api`

From the monorepo root, use Nx targets:

```bash
nx prisma:generate wc-nest-api
nx prisma:migrate wc-nest-api
nx prisma:seed wc-nest-api
nx prisma:studio wc-nest-api
nx prisma:reset wc-nest-api
```

Or from the app directory (`apps/wc-nest-api/`):

```bash
npx prisma generate
npx prisma migrate dev
ts-node prisma/seed.ts  # Note: NOT "npx prisma db seed"
npx prisma studio
npx prisma migrate reset
```

### Important Note on Seeding

- ❌ **DO NOT USE**: `npx prisma db seed` (requires global config in root package.json)
- ✅ **USE INSTEAD**: `nx prisma:seed wc-nest-api` (from root) or `ts-node prisma/seed.ts` (from app dir)

## Adding Prisma to a New Application

When you need to add Prisma to another application (e.g., `schoolable-nest-api`):

### 1. Create Prisma Directory Structure

```bash
cd apps/your-app-name
mkdir prisma
touch prisma/schema.prisma
touch prisma/seed.ts
```

### 2. Add Prisma Targets to `project.json`

Copy the Prisma targets from `apps/wc-nest-api/project.json` and update the `cwd` path:

```json
{
  "targets": {
    "prisma:generate": {
      "executor": "nx:run-commands",
      "options": {
        "command": "prisma generate",
        "cwd": "apps/your-app-name"
      }
    },
    "prisma:migrate": {
      "executor": "nx:run-commands",
      "options": {
        "command": "prisma migrate dev",
        "cwd": "apps/your-app-name"
      }
    },
    "prisma:migrate:deploy": {
      "executor": "nx:run-commands",
      "options": {
        "command": "prisma migrate deploy",
        "cwd": "apps/your-app-name"
      }
    },
    "prisma:seed": {
      "executor": "nx:run-commands",
      "options": {
        "command": "ts-node prisma/seed.ts",
        "cwd": "apps/your-app-name"
      }
    },
    "prisma:studio": {
      "executor": "nx:run-commands",
      "options": {
        "command": "prisma studio",
        "cwd": "apps/your-app-name"
      }
    },
    "prisma:reset": {
      "executor": "nx:run-commands",
      "options": {
        "command": "prisma migrate reset",
        "cwd": "apps/your-app-name"
      }
    }
  }
}
```

### 3. Configure Environment Variables

Create `.env` file in the app directory with a unique database:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/your_unique_database_name"
```

### 4. Initialize Prisma

```bash
nx prisma:generate your-app-name
nx prisma:migrate your-app-name
nx prisma:seed your-app-name
```

## Benefits of This Approach

1. ✅ **Clear Separation**: Each app manages its own database and Prisma configuration
2. ✅ **No Conflicts**: Multiple apps can have different Prisma schemas and databases
3. ✅ **Nx Integration**: Proper use of Nx targets for task orchestration
4. ✅ **Scalability**: Easy to add Prisma to new applications
5. ✅ **Portability**: Each app can be extracted or deployed independently
6. ✅ **Developer Experience**: Clear, consistent commands across all applications

## Reference

For more details on available commands, see [COMMANDS.md](./COMMANDS.md).

