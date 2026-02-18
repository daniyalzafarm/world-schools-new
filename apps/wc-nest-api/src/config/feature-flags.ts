/**
 * Feature Flags for WC Nest API
 *
 * Controls backend feature toggles for gradual rollout.
 * Values are read from environment variables.
 */

export const FEATURE_FLAGS = {
  WEBSOCKET_MESSAGES: process.env.ENABLE_WEBSOCKET_MESSAGES === 'true',
} as const

export function isFeatureEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag]
}
