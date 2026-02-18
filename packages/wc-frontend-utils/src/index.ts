/**
 * Frontend-specific utilities for World Camps applications
 *
 * This package contains React components and frontend-only utilities.
 * For backend-compatible utilities, use @world-schools/wc-utils
 */

// Auth components
export * from './lib/auth-provider'
export * from './lib/protected-route'

// Auth state management
export * from './lib/create-auth-store'

// Theme configuration
export * from './lib/theme-config'

// Password validation utilities
export * from './lib/password-validation'
export * from './lib/password-requirements-display'

// Emoji constants
export * from './lib/emoji'

// String formatting utilities
export * from './lib/string-format'

// Meals and dietary options constants
export * from './constants/meals-activities'

// Location and campus facilities constants
export * from './constants/location-campus-activities'

// Messaging types (enums, models, DTOs, utilities)
export * from './lib/messaging/types'

// Messaging services (conversations, messages, WebSocket)
export * from './lib/messaging/services'

// Messaging store (Zustand store factory)
export * from './lib/messaging/store'

// Global WebSocket service (shared across apps)
export * from './lib/websocket'

// Messaging WebSocket adapter
export {
  createMessagingWebSocketAdapter,
  type MessagingWebSocketAdapter,
} from './lib/messaging/adapters/messaging-websocket-adapter'

// Feature flags (shared across apps)
export * from './lib/config/feature-flags'
