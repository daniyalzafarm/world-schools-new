# Prisma Database Configuration

This directory contains the Prisma schema, migrations, and seed file for the wc-nest-api application.

## Files

- **`schema.prisma`** - Database schema definition
- **`migrations/`** - Database migration files
- **`seed.ts`** - TypeScript seed file (single source of truth)

## Database Seeding

### How It Works

We use a **single seed file** (`seed.ts`) for both development and production:

1. **Development (Local)**
   - Runs directly with `tsx` (TypeScript executor)
   - Uses `prisma.config.ts` seed command: `tsx apps/wc-nest-api/prisma/seed.ts`

2. **Production (Docker)**
   - `seed.ts` is automatically bundled to JavaScript during Docker build using esbuild
   - The bundled file includes all dependencies (permissions, bcrypt, etc.)
   - Runs with Node.js (no TypeScript runtime needed)
   - Uses `prisma.config.ts` seed command: `node dist/prisma/seed.js`

### Benefits of This Approach

✅ **Single source of truth** - Only maintain `seed.ts`
✅ **No sync issues** - Production bundle is auto-generated from `seed.ts`
✅ **Type safety** - Full TypeScript support in development
✅ **Small image size** - No TypeScript runtime in production
✅ **Fast builds** - esbuild is extremely fast (~2-5 seconds)

### Running Seeds

**Local Development:**
```bash
# From monorepo root
nx prisma:seed wc-nest-api

# Or from app directory
cd apps/wc-nest-api
npx prisma db seed
```

**Production (Docker):**
The seed runs automatically during container startup via `start.sh`.

### Modifying Seed Data

To add or modify permissions, roles, or users:

1. **Update permissions** in `apps/wc-nest-api/src/config/permissions.ts`
2. **Update seed logic** in `apps/wc-nest-api/prisma/seed.ts`
3. **Test locally**: `nx prisma:seed wc-nest-api`
4. **Commit changes** - The production bundle will be auto-generated during Docker build

That's it! No need to maintain separate files or worry about sync issues.

## Migrations

### Creating a Migration

```bash
# From monorepo root
nx prisma:migrate wc-nest-api

# Or from app directory
cd apps/wc-nest-api
npx prisma migrate dev --name your_migration_name
```

### Deploying Migrations

Migrations are automatically deployed during container startup in production.

For manual deployment:
```bash
nx prisma:migrate:deploy wc-nest-api
```

## Prisma Studio

To view and edit database data:

```bash
nx prisma:studio wc-nest-api
```

## Database Reset

**⚠️ WARNING: This will delete all data!**

```bash
nx prisma:reset wc-nest-api
```

