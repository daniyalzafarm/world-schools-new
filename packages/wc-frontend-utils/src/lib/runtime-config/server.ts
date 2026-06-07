import type { BaseRuntimeConfig } from './types'

const isProd = process.env['NODE_ENV'] === 'production'
// `next build` sets NEXT_PHASE; runtime env vars aren't present then, so we
// must not throw at build time even when NODE_ENV=production.
const isBuildPhase = process.env['NEXT_PHASE'] === 'phase-production-build'

/**
 * Read an env var. Throws in production runtime if missing; returns a
 * fallback during `next build` and in non-production so local dev / build
 * don't require a full env file.
 */
export function requireEnv(name: string, devFallback = ''): string {
  const value = process.env[name]
  if (value) return value
  if (isProd && !isBuildPhase) {
    throw new Error(`Missing required runtime env: ${name}`)
  }
  return devFallback
}

export function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback
  return value === 'true' || value === '1'
}

/**
 * Read the base runtime config from process.env on the server.
 *
 * Each app composes its own cross-link fields (e.g. providerAppUrl) on top of
 * this base object — see the per-app runtime-config.ts files.
 */
export function readBaseServerConfig(): BaseRuntimeConfig {
  return {
    apiBaseUrl: requireEnv('API_BASE_URL', 'http://localhost:3000/'),
    appUrl: requireEnv('APP_URL', 'http://localhost:3000'),
    appVersion: process.env['APP_VERSION'] ?? 'dev',
    wsUrl: process.env['WS_URL'] ?? (isProd && !isBuildPhase ? undefined : 'http://localhost:3000'),
    authUsingRequest: parseBool(process.env['AUTH_USING_REQUEST'], false),
    googleMapsApiKey: process.env['GOOGLE_MAPS_API_KEY'],
    stripePublishableKey: process.env['STRIPE_PUBLISHABLE_KEY'],
    enableWebsocketMessages: parseBool(process.env['ENABLE_WEBSOCKET_MESSAGES'], true),
    websocketFallbackHttp: parseBool(process.env['WEBSOCKET_FALLBACK_HTTP'], true),
  }
}
