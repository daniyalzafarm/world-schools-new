/**
 * Feature Flags for World Schools Applications
 *
 * Shared across wc-booking and wc-provider apps.
 * Apps can override via environment variables.
 *
 * @example
 * ```typescript
 * // In shared package (default flags)
 * import { isFeatureEnabled } from '@world-schools/wc-frontend-utils'
 *
 * if (isFeatureEnabled('WEBSOCKET_MESSAGES')) {
 *   // Use WebSocket for message sending
 * }
 *
 * // In app configuration
 * import { createFeatureFlags } from '@world-schools/wc-frontend-utils'
 *
 * const FEATURE_FLAGS = createFeatureFlags({
 *   WEBSOCKET_MESSAGES: process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET_MESSAGES === 'true',
 * })
 * ```
 */

export interface FeatureFlags {
  WEBSOCKET_MESSAGES: boolean
  WEBSOCKET_FALLBACK_TO_HTTP: boolean
}

export function createFeatureFlags(overrides?: Partial<FeatureFlags>): FeatureFlags {
  return {
    WEBSOCKET_MESSAGES: false, // Default: disabled
    WEBSOCKET_FALLBACK_TO_HTTP: true, // Default: enabled
    ...overrides,
  }
}

// Browser environment check
const isBrowser = typeof window !== 'undefined'

// Default feature flags (can be overridden by apps)
export const FEATURE_FLAGS = createFeatureFlags(
  isBrowser
    ? {
        WEBSOCKET_MESSAGES: (window as any).__FEATURE_FLAGS__?.WEBSOCKET_MESSAGES ?? false,
        WEBSOCKET_FALLBACK_TO_HTTP:
          (window as any).__FEATURE_FLAGS__?.WEBSOCKET_FALLBACK_TO_HTTP ?? true,
      }
    : {}
)

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return FEATURE_FLAGS[flag]
}
