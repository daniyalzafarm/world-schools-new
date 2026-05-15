#!/bin/bash
set -e

# Compose DATABASE_URL from POSTGRES_* parts if it isn't already set.
# Prisma CLI (`migrate deploy`, `db seed`) runs BEFORE NestJS boots, so
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

# Run Prisma migrations (Prisma 7 requires explicit env loading and prisma.config.ts at root)
echo "📦 Running Prisma migrations..."
node -r dotenv/config node_modules/.bin/prisma migrate deploy
echo "✅ Migrations completed"

# Run Prisma seed (Prisma 7 - use npx prisma db seed)
# The seed command is configured in prisma.config.ts to use the compiled seed file in production
echo "🌱 Seeding database..."
node -r dotenv/config node_modules/.bin/prisma db seed
echo "✅ Seeding completed"

# Start the application
echo "🎯 Starting the application..."
node dist/main.js
