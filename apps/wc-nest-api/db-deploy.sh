#!/bin/bash
set -e

# Entrypoint for the Prisma migration Container Apps Job (caj-migrate-wc-{stg,prod}).
# Runs the per-deploy database tasks ONCE, gated, before the API rolls out — migrations
# then the seed. The seed is intentionally NOT run on API container startup (see start.sh):
# the RBAC seeder prunes permissions not in its image's set, so running it on every replica
# lets lingering old-version replicas clobber newer permissions. Run it here, once per deploy.

# Compose DATABASE_URL from POSTGRES_* parts if not already provided (mirrors start.sh).
# The Job normally provides DATABASE_URL directly; this guard keeps the script working if
# it's ever given the POSTGRES_* parts instead.
if [ -z "$DATABASE_URL" ]; then
  DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
  if [ "$(echo "$POSTGRES_REQUIRE_SSL" | tr '[:upper:]' '[:lower:]')" = "true" ]; then
    DATABASE_URL="${DATABASE_URL}?sslmode=require"
  fi
  export DATABASE_URL
fi

echo "📦 Running Prisma migrations..."
node -r dotenv/config node_modules/.bin/prisma migrate deploy
echo "✅ Migrations completed"

# Run the esbuild-bundled seed directly (deterministic; the bundle is copied into the image
# at dist/prisma/seed.js by the Dockerfile). seed.ts reads DATABASE_URL from the environment.
echo "🌱 Seeding database..."
node dist/prisma/seed.js
echo "✅ Seeding completed"
