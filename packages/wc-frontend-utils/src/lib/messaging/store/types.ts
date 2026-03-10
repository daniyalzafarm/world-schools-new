/**
 * Type definitions for the messaging store
 *
 * This file contains all TypeScript types and interfaces used by the messaging store.
 * The store follows the same pattern as createAuthStore from @world-schools/wc-frontend-utils.
 */

import type {
  ConversationResponseDto,
  MessageResponseDto,
  SendMessageDto,
  PresenceStatus,
  OptimisticMessage,
  FailedMessage,
} from '../types'

/**
 * Messaging store state
 */
export interface MessagingState {
  /**
   * List of all conversations
   */
  conversations: ConversationResponseDto[]

  /**
   * Currently active conversation ID
   */
  activeConversationId: string | null

  /**
   * Messages grouped by conversation ID
   */
  messages: Record<string, MessageResponseDto[]>

  /**
   * WebSocket connection status
   */
  isConnected: boolean

  /**
   * Users currently typing in each conversation
   * Key: conversationId, Value: array of user IDs
   */
  typingUsers: Record<string, string[]>

  /**
   * User presence status
   * Key: userId, Value: presence status
   */
  userPresence: Record<string, PresenceStatus>

  /**
   * Messages being sent (optimistic updates)
   */
  pendingMessages: OptimisticMessage[]

  /**
   * Messages that failed to send
   */
  failedMessages: FailedMessage[]

  /**
   * Loading state for conversations list
   */
  isLoadingConversations: boolean

  /**
   * Loading state for messages by conversation ID
   * Key: conversationId, Value: loading state
   */
  isLoadingMessages: Record<string, boolean>

  /**
   * Error message for conversations
   */
  conversationsError: string | null

  /**
   * Error messages for messages by conversation ID
   * Key: conversationId, Value: error message
   */
  messagesError: Record<string, string | null>

  /**
   * Whether the store has been initialized
   */
  isInitialized: boolean

  /**
   * Draft conversation metadata (WhatsApp Web pattern)
   * Used when user clicks "Message" but hasn't sent first message yet
   * Conversation is created only when first message is sent
   */
  draftConversation: {
    providerId: string
    providerName: string
    participantType: 'provider' | 'superadmin'
    contextType?: string
    contextId?: string
    contextName?: string
  } | null
}

/**
 * Messaging store actions
 */
export interface MessagingActions {
  // Initialization
  /**
   * Initialize the messaging store (connect WebSocket, fetch initial data)
   */
  initialize: () => Promise<void>

  /**
   * Cleanup the messaging store (disconnect WebSocket, clear state)
   */
  cleanup: () => void

  // Conversations
  /**
   * Fetch all conversations
   */
  fetchConversations: () => Promise<void>

  /**
   * Create a new conversation with an initial message
   * ✅ NEW: Implements lazy conversation creation pattern
   */
  createConversationWithMessage: (params: {
    userId: string
    participantId: string
    participantType: 'provider' | 'superadmin'
    contextType?: string
    contextId?: string
    initialMessage: string
  }) => Promise<ConversationResponseDto>

  /**
   * Set the active conversation
   */
  setActiveConversation: (conversationId: string | null) => void

  /**
   * Update a conversation in the store
   */
  updateConversation: (conversationId: string, updates: Partial<ConversationResponseDto>) => void

  /**
   * Set draft conversation metadata (WhatsApp Web pattern)
   * Called when user clicks "Message" button before sending first message
   */
  setDraftConversation: (metadata: {
    providerId: string
    providerName: string
    participantType: 'provider' | 'superadmin'
    contextType?: string
    contextId?: string
    contextName?: string
  }) => void

  /**
   * Clear draft conversation metadata
   * Called after conversation is created or user navigates away
   */
  clearDraftConversation: () => void

  // Messages
  /**
   * Fetch messages for a conversation
   */
  fetchMessages: (conversationId: string) => Promise<void>

  /**
   * Send a message (with optimistic update)
   * Routes via WebSocket when enabled, falls back to HTTP
   */
  sendMessage: (dto: SendMessageDto) => Promise<void>

  /**
   * Send a message via HTTP (fallback method)
   * Used internally when WebSocket is unavailable or feature flag disabled
   */
  sendMessageViaHttp: (dto: SendMessageDto, optimisticMessage: OptimisticMessage) => Promise<void>

  /**
   * Add a message to the store (from WebSocket event)
   */
  addMessage: (message: MessageResponseDto) => void

  /**
   * Update a message in the store
   */
  updateMessage: (messageId: string, updates: Partial<MessageResponseDto>) => void

  /**
   * Delete a message from the store
   */
  deleteMessage: (conversationId: string, messageId: string) => void

  // Real-time features
  /**
   * Mark a message as read
   */
  markAsRead: (conversationId: string, messageId: string) => Promise<void>

  /**
   * Mark a message as delivered
   */
  markAsDelivered: (
    conversationId: string,
    messageId: string,
    deliveryLatencyMs?: number
  ) => Promise<void>

  /**
   * Start typing indicator
   */
  startTyping: (conversationId: string) => void

  /**
   * Stop typing indicator
   */
  stopTyping: (conversationId: string) => void

  // Offline support
  /**
   * Retry all failed messages
   */
  retryFailedMessages: () => Promise<void>

  /**
   * Retry a specific failed message
   */
  retryFailedMessage: (messageId: string) => Promise<void>

  /**
   * Remove a failed message from the queue
   */
  removeFailedMessage: (messageId: string) => void

  // Error handling
  /**
   * Clear conversations error
   */
  clearConversationsError: () => void

  /**
   * Clear messages error for a conversation
   */
  clearMessagesError: (conversationId: string) => void
}

/**
 * Combined messaging store type
 */
export type MessagingStore = MessagingState & MessagingActions
