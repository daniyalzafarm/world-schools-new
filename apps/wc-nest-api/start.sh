#!/bin/bash
set -e

# Compose DATABASE_URL from POSTGRES_* parts if it isn't already set.
# Prisma CLI (`migrate deploy`) runs BEFORE NestJS boots, so
# `ConfigService.databaseUrl` hasn't populated `process.env.DATABASE_URL`
# yet. Match the URL format Nest uses and append `?sslmode=require` when
# the managed Postgres demands SSL (Azure Flexible Server default).
if [ -z "$DATABASE_URL" ]; then
  DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
  if [ "$(echo "$POSTGRES_REQUIRE_SSL" | tr '[:upper:]' '[:lower:]')" = "true" ]; then
    DATABASE_URL="${DATABASE_URL}?sslmode=require"
  fi
  export DATABASE_URL
fi

echo "🚀 Starting World Camps NestJS API..."

# Run Prisma migrations (Prisma 7 requires explicit env loading and prisma.config.ts at root).
# Idempotent, non-destructive safety net — the deploy also runs migrations in the migration Job
# (caj-migrate-wc-*) before this container rolls out.
echo "📦 Running Prisma migrations..."
node -r dotenv/config node_modules/.bin/prisma migrate deploy
echo "✅ Migrations completed"

# NOTE: the database seed is intentionally NOT run here. The RBAC seeder prunes permissions not
# in its image's set, so running it on every replica startup lets lingering old-version replicas
# clobber newer permissions. Seeding runs ONCE per deploy in the migration Job (see db-deploy.sh).

# Start the application
echo "🎯 Starting the application..."
node dist/main.js
