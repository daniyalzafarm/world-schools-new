/**
 * Messaging Store for WC Provider
 *
 * This store is configured using the shared createMessagingStore factory
 * from @world-schools/wc-frontend-utils.
 *
 * Configuration:
 * - isProviderApp: true (provider app for camp staff/admins)
 * - enableAssignment: true (conversation assignment for provider team)
 * - Real-time WebSocket integration for live messaging
 * - Optimistic updates for better UX
 * - Message retry queue for failed sends
 * - Provider-specific features:
 *   - Shared visibility (all provider users see all conversations)
 *   - Auto-assignment on first reply
 *   - Exclusive reply rights enforcement
 *   - Assignment status tracking
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
  endpointPrefix: 'provider/messaging/conversations',
})

// Create messages service
const messagesService = createMessagesService({
  apiClient,
  endpointPrefix: 'provider/messaging/messages',
})

// Create messaging WebSocket adapter from global WS singleton (from providers.tsx)
const messagingWebSocket = createMessagingWebSocketAdapter(globalWsService)

// Create messaging store instance with provider-specific configuration
const { useMessagingStore } = createMessagingStore({
  apiClient,
  conversationsService,
  messagesService,
  messagingWebSocket,
  featureFlags: FEATURE_FLAGS,
  storageKeyPrefix: 'wc_provider',
  debug: config.app.version === 'dev',
  getCurrentUserId: () => useAuthStore.getState().user?.id ?? null,
})

export { useMessagingStore, conversationsService }
