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

// Messaging UI components (EnhancedMessageBubble, etc.)
export * from './lib/messaging/components'

// Global WebSocket service (shared across apps)
export * from './lib/websocket'

// Messaging WebSocket adapter
export {
  createMessagingWebSocketAdapter,
  type MessagingWebSocketAdapter,
} from './lib/messaging/adapters/messaging-websocket-adapter'

// Feature flags (shared across apps)
export * from './lib/config/feature-flags'

// Discount types configuration (static metadata for all discount categories)
export * from './lib/discount-types'

// Knowledge Base types (categories and articles)
export * from './lib/kb/types'

// Help (KB) shared module – service, context, components, page content
export * from './lib/kb/help'

// Booking group labels, formatting, journey (parent + provider apps)
export * from './lib/booking-group-display'

// Browser notification hook (shared across wc-* apps)
export {
  useNotifications,
  type BrowserNotificationOptions,
} from './lib/notifications/use-notifications'

// Support ticket conversation WebSocket hook (shared core for wc-booking + wc-provider)
export {
  useSupportConversationMessages,
  type SupportMessage,
} from './lib/messaging/hooks/use-support-conversation-messages'

// Support tickets — service factory, shared hooks, and shared UI components
export * from './lib/support-tickets'

// Notifications page (shared hook + UI across all wc-* apps)
export {
  useNotificationsPage,
  type NotificationFilter,
  type UseNotificationsPageOptions,
  type UseNotificationsPageResult,
  type NotificationsPageResponse,
} from './lib/notifications/use-notifications-page'
export {
  NotificationsPageContent,
  type NotificationsPageContentProps,
} from './lib/notifications/notifications-page-content'
