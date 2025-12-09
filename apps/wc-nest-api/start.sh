#!/bin/bash
set -e

echo "🚀 Starting World Camps NestJS API..."

# Run Prisma migrations (Prisma 7 requires explicit env loading and prisma.config.ts at root)
echo "📦 Running Prisma migrations..."
node -r dotenv/config node_modules/.bin/prisma migrate deploy
echo "✅ Migrations completed"

# Run Prisma seed (Prisma 7 - use npx prisma db seed)
echo "🌱 Seeding database..."
node -r dotenv/config node_modules/.bin/prisma db seed
echo "✅ Seeding completed"

# Start the application
echo "🎯 Starting the application..."
node dist/main.js

