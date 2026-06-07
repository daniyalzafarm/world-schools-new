/**
 * Feature Flags Configuration for WC Booking
 *
 * All logic is in @world-schools/wc-frontend-utils; values resolve from the
 * runtime config injected by the root layout (no NEXT_PUBLIC_* baked in).
 */

import { createFeatureFlags } from '@world-schools/wc-frontend-utils'

import { getRuntimeConfig } from './runtime-config'

const runtime = getRuntimeConfig()

export const FEATURE_FLAGS = createFeatureFlags({
  WEBSOCKET_MESSAGES: runtime.enableWebsocketMessages,
  WEBSOCKET_FALLBACK_TO_HTTP: runtime.websocketFallbackHttp,
})

// Expose to window for shared package to access
if (typeof window !== 'undefined') {
  ;(window as any).__FEATURE_FLAGS__ = FEATURE_FLAGS
}
