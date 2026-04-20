FROM node:24-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY nx.json ./
COPY tsconfig.base.json ./

# Install dependencies
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Accept space-separated environment variables as a single build arg
# Format: "KEY1=value1 KEY2=value2 KEY3=value3"
# Example: "NEXT_PUBLIC_API_BASE_URL=https://api.com NEXT_PUBLIC_AUTH_USING_REQUEST=false NEXT_PUBLIC_APP_VERSION=1.0.0"
ARG BUILD_ENV=""

# Parse BUILD_ENV and set environment variables for Next.js build
# This approach uses a shell script to export variables before running the build
RUN set -e; \
    if [ -n "$BUILD_ENV" ]; then \
      echo "Parsing build environment variables..."; \
      # Create a temporary script to export variables
      echo '#!/bin/sh' > /tmp/set-env.sh; \
      echo 'set -e' >> /tmp/set-env.sh; \
      # Parse each KEY=value pair and add export statements
      for pair in $BUILD_ENV; do \
        key=$(echo "$pair" | cut -d'=' -f1); \
        value=$(echo "$pair" | cut -d'=' -f2-); \
        echo "export $key=\"$value\"" >> /tmp/set-env.sh; \
        echo "Set $key=$value"; \
      done; \
      # Add the build command to the script
      echo 'npx nx build wc-provider' >> /tmp/set-env.sh; \
      chmod +x /tmp/set-env.sh; \
      # Execute the script (this ensures exports are available during build)
      /tmp/set-env.sh; \
    else \
      # No BUILD_ENV provided, run build with defaults
      npx nx build wc-provider; \
    fi

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy the standalone build
COPY --from=builder --chown=nextjs:nodejs /app/apps/wc-provider/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/wc-provider/.next/static ./apps/wc-provider/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/wc-provider/public ./apps/wc-provider/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ > /dev/null || exit 1

CMD ["node", "apps/wc-provider/server.js"]
