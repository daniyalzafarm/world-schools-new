#!/bin/bash

# Test script to verify seed file bundling works correctly
# This simulates what happens during Docker build

set -e

echo "🧪 Testing seed file bundling with esbuild..."
echo ""

# Clean up any previous test output
rm -rf dist/apps/wc-nest-api/prisma/seed.js 2>/dev/null || true

# Create output directory
mkdir -p dist/apps/wc-nest-api/prisma

# Run esbuild (same command as in Dockerfile)
echo "📦 Bundling seed.ts..."
npx esbuild apps/wc-nest-api/prisma/seed.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=cjs \
  --outfile=dist/apps/wc-nest-api/prisma/seed.js \
  --external:@prisma/client \
  --external:@prisma/adapter-pg \
  --external:bcryptjs \
  --external:pg \
  --external:pg-pool

# Check if bundle was created
if [ -f "dist/apps/wc-nest-api/prisma/seed.js" ]; then
  echo "✅ Bundle created successfully!"
  echo ""
  echo "📊 Bundle size:"
  ls -lh dist/apps/wc-nest-api/prisma/seed.js | awk '{print "   " $5 " - " $9}'
  echo ""
  echo "📝 First 20 lines of bundled file:"
  head -n 20 dist/apps/wc-nest-api/prisma/seed.js
  echo ""
  echo "✅ Test passed! Seed bundling works correctly."
else
  echo "❌ Test failed! Bundle was not created."
  exit 1
fi

