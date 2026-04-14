/**
 * Messaging Store for WC Booking
 *
 * This store is configured using the shared createMessagingStore factory
 * from @world-schools/wc-frontend-utils.
 *
 * Configuration:
 * - isProviderApp: false (booking app for parents/students)
 * - enableAssignment: false (no conversation assignment for booking app)
 * - Real-time WebSocket integration for live messaging
 * - Optimistic updates for better UX
 * - Message retry queue for failed sends
 */

import {
  createConversationsService,
  createMessagesService,
  createMessagingStore,
  createMessagingWebSocketAdapter,
} from '@world-schools/wc-frontend-utils'
import apiClient from '@/utils/api-client'
import { globalWsService } from '@/lib/websocket-instance'
import config from '@/config/config'
import { FEATURE_FLAGS } from '@/config/feature-flags'
import { useAuthStore } from '@/stores/auth-store'

// Create conversations service
const conversationsService = createConversationsService({
  apiClient,
  endpointPrefix: 'user/messaging/conversations',
})

// Create messages service
const messagesService = createMessagesService({
  apiClient,
  endpointPrefix: 'user/messaging/messages',
})

// Create messaging WebSocket adapter from global WS singleton (from providers.tsx)
const messagingWebSocket = createMessagingWebSocketAdapter(globalWsService)

// Create messaging store instance with booking-specific configuration
const { useMessagingStore } = createMessagingStore({
  apiClient,
  conversationsService,
  messagesService,
  messagingWebSocket,
  featureFlags: FEATURE_FLAGS,
  storageKeyPrefix: 'wc_booking',
  debug: config.app.version === 'dev',
  getCurrentUserId: () => useAuthStore.getState().user?.id ?? null,
})

export { useMessagingStore, conversationsService, messagingWebSocket }
