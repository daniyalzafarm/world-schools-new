/**
 * Feature Flags Configuration for WC Booking
 *
 * This file configures feature flags for the booking app.
 * All logic is in @world-schools/wc-frontend-utils.
 */

import { createFeatureFlags } from '@world-schools/wc-frontend-utils'

export const FEATURE_FLAGS = createFeatureFlags({
  WEBSOCKET_MESSAGES: process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET_MESSAGES === 'true',
  WEBSOCKET_FALLBACK_TO_HTTP: process.env.NEXT_PUBLIC_WEBSOCKET_FALLBACK_HTTP !== 'false',
})

// Expose to window for shared package to access
if (typeof window !== 'undefined') {
  ;(window as any).__FEATURE_FLAGS__ = FEATURE_FLAGS
}
