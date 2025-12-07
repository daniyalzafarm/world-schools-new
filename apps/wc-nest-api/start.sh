#!/bin/bash
set -e

echo "🚀 Starting World Camps NestJS API..."

# Run Prisma migrations (Prisma 7 requires explicit env loading)
echo "📦 Running Prisma migrations..."
cd prisma
node -r dotenv/config ../node_modules/.bin/prisma migrate deploy
echo "✅ Migrations completed"

# Run Prisma seed (Prisma 7 - use npx prisma db seed)
echo "🌱 Seeding database..."
node -r dotenv/config ../node_modules/.bin/prisma db seed
echo "✅ Seeding completed"

# Go back to app directory
cd ..

# Start the application
echo "🎯 Starting the application..."
node dist/main.js

