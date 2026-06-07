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

# No build-time env vars: all configuration is injected at runtime via the
# Container App's env vars and read by the layout's inline <script> + the
# /config.json route handler. The same image runs in any environment.
RUN npx nx build wc-superadmin

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy the standalone build
COPY --from=builder --chown=nextjs:nodejs /app/apps/wc-superadmin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/wc-superadmin/.next/static ./apps/wc-superadmin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/wc-superadmin/public ./apps/wc-superadmin/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ > /dev/null || exit 1

CMD ["node", "apps/wc-superadmin/server.js"]
