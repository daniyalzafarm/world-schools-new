# Stage 1: Build
FROM node:24-slim AS builder

WORKDIR /app

# Install OpenSSL and other dependencies required by Prisma
RUN apt-get update -y && apt-get install -y openssl

# Copy root package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy the entire monorepo
COPY . .

# Accept DATABASE_URL as build arg (only needed for prisma generate, not for actual DB connection)
# This is a placeholder value since prisma generate doesn't actually connect to the database
ARG DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"

# Generate Prisma Client (Prisma 7 requires explicit env loading and prisma.config.ts at root)
# The DATABASE_URL env var is required by prisma.config.ts but not used during generation
ENV DATABASE_URL=${DATABASE_URL}
RUN node_modules/.bin/prisma generate

# Build the wc-nest-api application using Nx
RUN npx nx build wc-nest-api --configuration=production

# Bundle the seed file for production using esbuild
# This creates a standalone JavaScript file that includes all dependencies
# and can run without tsx/ts-node in production
RUN npx esbuild apps/wc-nest-api/prisma/seed.ts \
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

# Stage 2: Production
FROM node:24-slim

WORKDIR /app

# Install OpenSSL in runtime stage (required by Prisma)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy the built application from builder
COPY --from=builder /app/dist/apps/wc-nest-api ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy Prisma config and schema files for migrations
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/apps/wc-nest-api/prisma/schema.prisma ./apps/wc-nest-api/prisma/schema.prisma
COPY --from=builder /app/apps/wc-nest-api/prisma/migrations ./apps/wc-nest-api/prisma/migrations

# Copy the bundled seed file (auto-generated from seed.ts during build)
COPY --from=builder /app/dist/apps/wc-nest-api/prisma/seed.js ./dist/prisma/seed.js

# Copy the startup script
COPY apps/wc-nest-api/start.sh ./start.sh
RUN chmod +x ./start.sh

# Expose the application port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["./start.sh"]

