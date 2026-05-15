// libpq sslmode values that actually negotiate TLS. `disable`, `allow`,
// `prefer` are deliberately excluded — they don't *require* TLS.
const SSL_MODE_REQUIRES_TLS = /[?&]sslmode=(require|verify-ca|verify-full)\b/i

/**
 * Single source of truth for "should the Postgres connection negotiate TLS?".
 *
 * Used by `ConfigService.postgresRequireSsl` (NestJS runtime, via PrismaService)
 * and by `prisma/seed.ts` (pre-boot, run by start.sh). `start.sh` mirrors the
 * env-var half of this check in bash to decide whether to append
 * `?sslmode=require` to the composed DATABASE_URL.
 *
 * Returns true if either:
 *   - POSTGRES_REQUIRE_SSL env var is "true" (case-insensitive), OR
 *   - DATABASE_URL contains sslmode=require|verify-ca|verify-full.
 */
export function requiresPostgresSsl(
  env: NodeJS.ProcessEnv = process.env,
  databaseUrl?: string
): boolean {
  const fromEnv = (env.POSTGRES_REQUIRE_SSL ?? '').toLowerCase() === 'true'
  const fromUrl = databaseUrl ? SSL_MODE_REQUIRES_TLS.test(databaseUrl) : false
  return fromEnv || fromUrl
}
