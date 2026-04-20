# Stage 1: Build
FROM node:24-slim AS builder

WORKDIR /app

# Install OpenSSL and other dependencies required by Prisma
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

# Copy root package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN --mount=type=cache,target=/root/.npm \
    npm ci

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
# generatePackageJson: true in webpack.config.js produces dist/apps/wc-nest-api/package.json
# containing only the packages this app actually imports at runtime (~37 packages)
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

# Stage 2: Minimal production dependencies
# Uses the Nx-generated package.json (~37 packages) instead of the full monorepo node_modules
FROM node:24-slim AS prod-deps

WORKDIR /app

RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

# Generated package.json only lists what wc-nest-api actually imports.
# Root package-lock.json is needed so npm ci uses identical transitive dep
# versions as builder (prevents version-mismatch errors like proper-lockfile
# incompatibilities with Node.js 24).
COPY --from=builder /app/dist/apps/wc-nest-api/package.json ./package.json
COPY --from=builder /app/package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

# Restore the full @prisma scope from builder where npm ci ran with scripts.
# --ignore-scripts above skips @prisma/engines postinstall (which extracts engine
# binaries) and @prisma/client postinstall (which would run prisma generate without
# a schema). Copying from builder restores the correctly extracted and generated state.
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Stage 3: Production runner
FROM node:24-slim AS runner

WORKDIR /app

# Install OpenSSL (required by Prisma) and curl (for HEALTHCHECK)
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl curl \
 && rm -rf /var/lib/apt/lists/*

# Create non-root system user
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nestjs

# Copy the built application and minimal node_modules
COPY --from=builder /app/dist/apps/wc-nest-api ./dist
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules

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

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -sf http://localhost:3000/health | grep -q '"status":"ok"' || exit 1

USER nestjs

# Start the application
CMD ["./start.sh"]
