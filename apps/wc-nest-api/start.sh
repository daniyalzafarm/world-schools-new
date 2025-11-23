#!/bin/bash
set -e

echo "🚀 Starting World Camps NestJS API..."

# Run Prisma migrations
echo "📦 Running Prisma migrations..."
cd prisma
npx prisma migrate deploy
echo "✅ Migrations completed"

# Run Prisma seed (optional - comment out if you don't want to seed in production)
echo "🌱 Seeding database..."
npx ts-node seed.ts
echo "✅ Seeding completed"

# Go back to app directory
cd ..

# Start the application
echo "🎯 Starting the application..."
node dist/main.js

