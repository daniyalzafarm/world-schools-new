/**
 * Messaging Store Factory for World Camps Applications
 *
 * This factory creates a configured Zustand store for messaging state management.
 * It handles conversations, messages, WebSocket integration, optimistic updates,
 * and real-time features (typing indicators, presence, receipts).
 *
 * @example
 * ```typescript
 * import { createApiClient } from '@world-schools/wc-utils'
 * import { createConversationsService, createMessagesService, createMessagingStore, createMessagingWebSocketAdapter, createGlobalWebSocketService } from '@world-schools/wc-frontend-utils'
 *
 * const apiClient = createApiClient({
 *   baseURL: 'http://localhost:3000/',
 *   usingRequest: false,
 *   storageKeyPrefix: 'wc_booking',
 *   refreshEndpoint: '/auth/refresh'
 * })
 *
 * const conversationsService = createConversationsService({ apiClient })
 * const messagesService = createMessagesService({ apiClient })
 * const globalWsService = createGlobalWebSocketService({ url: 'http://localhost:3000', ... })
 * const messagingWebSocket = createMessagingWebSocketAdapter(globalWsService)
 *
 * const { useMessagingStore } = createMessagingStore({
 *   apiClient,
 *   conversationsService,
 *   messagesService,
 *   messagingWebSocket,
 *   storageKeyPrefix: 'wc_booking',
 * })
 *
 * // Use in components
 * function MessagesPage() {
 *   const { conversations, sendMessage, isConnected } = useMessagingStore()
 *   // ...
 * }
 * ```
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { ApiClient } from '@world-schools/wc-utils'
import type {
  SendMessageDto,
  MessageResponseDto,
  OptimisticMessage,
  FailedMessage,
  ConversationResponseDto,
} from '../types'
import { MessageStatus, PresenceStatus } from '../types'
import type { ConversationsService } from '../services/create-conversations-service'
import type { MessagesService } from '../services/create-messages-service'
import type { MessagingWebSocketAdapter } from '../adapters/messaging-websocket-adapter'
import type { FeatureFlags } from '../../config/feature-flags'
import { messageQueue } from '../message-queue'
import type { MessagingStore } from './types'

/**
 * Add `delta` to the viewer's per-conversation unread count, creating the
 * viewer's participant entry when it is missing.
 *
 * Provider-org viewers have no real `ConversationParticipant` row until they
 * first reply, and a conversation that arrived via `conversation:new` carries no
 * viewer-scoped virtual participant — so the per-conversation badge (read from
 * the viewer's own participant) would otherwise never update in real time. The
 * synthesized entry mirrors the backend virtual participant shape and is local
 * only; the next `fetchConversations` replaces it with the server-computed value.
 */
export function addViewerUnread(
  conversation: ConversationResponseDto,
  currentUserId: string,
  delta: number
): void {
  if (!conversation.participants) conversation.participants = []
  let participant = conversation.participants.find(p => p.userId === currentUserId)
  if (!participant) {
    const providerId = (conversation.metadata as { providerId?: string } | null)?.providerId ?? null
    participant = { userId: currentUserId, providerId, unreadCount: 0 } as any
    conversation.participants.push(participant!)
  }
  participant!.unreadCount = (participant!.unreadCount ?? 0) + delta
}

/**
 * Configuration options for creating a messaging store instance
 */
export interface MessagingStoreConfig {
  /**
   * Configured API client instance
   */
  apiClient: ApiClient

  /**
   * Configured conversations service instance
   */
  conversationsService: ConversationsService

  /**
   * Configured messages service instance
   */
  messagesService: MessagesService

  /**
   * Messaging WebSocket adapter (global WebSocket, root namespace)
   * Handles real-time message sending, typing indicators, presence, and receipts.
   */
  messagingWebSocket: MessagingWebSocketAdapter

  /**
   * Optional feature flags configuration
   * Controls WebSocket message sending behavior.
   * Defaults: WEBSOCKET_MESSAGES=false, WEBSOCKET_FALLBACK_TO_HTTP=true
   */
  featureFlags?: Partial<FeatureFlags>

  /**
   * Prefix for storage keys (e.g., 'wc_booking', 'wc_provider')
   * @example 'wc_booking' -> 'wc_booking_messaging'
   */
  storageKeyPrefix: string

  /**
   * Whether to enable debug logging
   * @default false
   */
  debug?: boolean

  /**
   * Returns the currently authenticated user id (UUID).
   * Used for HTTP receipt endpoints that require userId in the body.
   *
   * Note: WebSocket receipts derive userId from the socket session.
   */
  getCurrentUserId?: () => string | null | undefined
}

/**
 * Creates a configured messaging store instance
 *
 * @param config - Configuration options for the messaging store
 * @returns Object containing the useMessagingStore hook
 */
export function createMessagingStore(config: MessagingStoreConfig) {
  const {
    conversationsService,
    messagesService,
    messagingWebSocket,
    featureFlags: flagsOverride,
    debug = false,
    getCurrentUserId,
  } = config

  // Resolve feature flags with defaults
  const featureFlags: FeatureFlags = {
    WEBSOCKET_MESSAGES: flagsOverride?.WEBSOCKET_MESSAGES ?? false,
    WEBSOCKET_FALLBACK_TO_HTTP: flagsOverride?.WEBSOCKET_FALLBACK_TO_HTTP ?? true,
  }

  // Track which conversation rooms we have joined for this store instance.
  // To get world-class delivery semantics, we join conversation rooms while the user is
  // "in the app" (connected), not only when they open a specific thread.
  const joinedConversations = new Set<string>()

  // Collects every WebSocket unsubscribe function returned by messagingWebSocket.on*() calls
  // inside initialize(). Cleared by cleanup() to prevent listener accumulation across
  // login/logout cycles (each cycle would otherwise double the handler count).
  const wsUnsubscribers: Array<() => void> = []

  // Synchronous guard that prevents a second concurrent call to initialize() from
  // racing past the Zustand isInitialized check (which is committed only after all
  // listener registrations complete).  A closure boolean is visible immediately to
  // any concurrent synchronous caller, unlike the async Zustand state update.
  let isInitializing = false

  const ensureJoined = (conversationId: string) => {
    if (!conversationId) return
    if (!featureFlags.WEBSOCKET_MESSAGES) return
    if (!messagingWebSocket.isConnected()) return
    if (joinedConversations.has(conversationId)) return
    messagingWebSocket.joinConversation(conversationId)
    joinedConversations.add(conversationId)
  }

  const joinAllKnownConversations = () => {
    const state = useMessagingStore.getState()
    for (const c of state.conversations) {
      ensureJoined(c.id)
    }
    if (state.activeConversationId) {
      ensureJoined(state.activeConversationId)
    }
  }

  const log = (...args: any[]) => {
    if (debug) {
      console.log('[MessagingStore]', ...args)
    }
  }

  const logError = (...args: any[]) => {
    console.error('[MessagingStore]', ...args)
  }

  const useMessagingStore = create<MessagingStore>()(
    immer((set, get) => ({
      // Initial state
      conversations: [],
      activeConversationId: null,
      messages: {},
      isConnected: false,
      typingUsers: {},
      userPresence: {},
      pendingMessages: [],
      failedMessages: [],
      isLoadingConversations: false,
      isLoadingMessages: {},
      conversationsError: null,
      messagesError: {},
      messagesNextCursor: {},
      messagesHasMore: {},
      isLoadingMoreMessages: {},
      rateLimitRetryAfter: null,
      isInitialized: false,
      draftConversation: null,

      // Initialization
      initialize: async () => {
        const state = get()
        if (state.isInitialized) {
          log('Already initialized, skipping')
          return
        }
        if (isInitializing) {
          log('Initialization already in progress, skipping')
          return
        }
        isInitializing = true

        log('Initializing messaging store...')

        try {
          // Set up global WebSocket adapter connection tracking
          wsUnsubscribers.push(
            messagingWebSocket.onConnected(() => {
              log('WebSocket connected - updating isConnected state')
              set(draft => {
                draft.isConnected = true
              })

              // Join rooms for all known conversations so messages can be delivered
              // while the user is simply online in the app.
              joinAllKnownConversations()

              // Bulk-deliver all SENT messages that arrived while offline.
              // This mirrors WhatsApp/Signal: DELIVERED means the app received it,
              // READ means the user actually opened the conversation.
              void messagesService
                .markAllDelivered()
                .catch(err => log('markAllDelivered on connect failed:', err))
            })
          )

          wsUnsubscribers.push(
            messagingWebSocket.onDisconnected(() => {
              log('WebSocket disconnected - updating isConnected state')
              set(draft => {
                draft.isConnected = false
              })
            })
          )

          // Set initial connection state
          set(draft => {
            draft.isConnected = messagingWebSocket.isConnected()
          })

          // Set up global WebSocket adapter event listeners for message sending
          if (featureFlags.WEBSOCKET_MESSAGES) {
            log('Setting up global WebSocket adapter event listeners (WebSocket messages enabled)')

            // Handle message confirmation from server (sender only)
            // Replaces optimistic message with real server-confirmed message
            wsUnsubscribers.push(
              messagingWebSocket.onMessageCreated(
                (data: { message: MessageResponseDto; tempId: string }) => {
                  log('Received message:created confirmation:', data.tempId, '->', data.message.id)

                  set(draft => {
                    const conversationId = data.message.conversationId
                    const messages = draft.messages[conversationId]
                    if (messages) {
                      const optimisticIndex = messages.findIndex(m => m.id === data.tempId)
                      const realMessageIndex = messages.findIndex(m => m.id === data.message.id)

                      // If real message already exists (from message:new broadcast), remove optimistic
                      if (realMessageIndex !== -1) {
                        if (optimisticIndex !== -1) {
                          messages.splice(optimisticIndex, 1)
                        }
                      } else if (optimisticIndex !== -1) {
                        // Replace optimistic message with real message
                        messages[optimisticIndex] = data.message
                      } else {
                        // Edge case: optimistic not found, add the real message
                        messages.push(data.message)
                      }
                    }

                    // Remove from pending messages and clear rate limit cooldown on success
                    draft.pendingMessages = draft.pendingMessages.filter(m => m.id !== data.tempId)
                    draft.rateLimitRetryAfter = null
                  })
                }
              )
            )

            // Handle message errors from server
            // Marks optimistic message as FAILED and moves to failedMessages
            wsUnsubscribers.push(
              messagingWebSocket.onMessageError((data: { tempId: string; error: string }) => {
                log('Received message:error for:', data.tempId, 'Error:', data.error)

                set(draft => {
                  // Find the optimistic message across all conversations
                  for (const conversationId in draft.messages) {
                    const messages = draft.messages[conversationId]
                    const optimisticIndex = messages.findIndex(m => m.id === data.tempId)
                    if (optimisticIndex !== -1) {
                      const optimistic = messages[optimisticIndex]
                      const failedMessage: FailedMessage = {
                        id: data.tempId,
                        conversationId,
                        senderId: (optimistic as any).senderId || '',
                        senderType: (optimistic as any).senderType || 'USER',
                        content: (optimistic as any).content || '',
                        status: 'FAILED',
                        sentAt: (optimistic as any).sentAt || new Date(),
                        isOptimistic: true,
                        idempotencyKey: (optimistic as any).idempotencyKey || data.tempId,
                        error: data.error,
                        retryCount: 0,
                        lastRetryAt: null,
                      }
                      messages[optimisticIndex] = failedMessage as unknown as MessageResponseDto
                      draft.failedMessages.push(failedMessage)
                      break
                    }
                  }

                  // Remove from pending messages
                  draft.pendingMessages = draft.pendingMessages.filter(m => m.id !== data.tempId)
                })
              })
            )

            // Handle new messages from other users via global WebSocket
            wsUnsubscribers.push(
              messagingWebSocket.onMessageNew(
                (data: { message: MessageResponseDto; tempId?: string }) => {
                  log('Received message:new via global WebSocket:', data.message.id)

                  // Replace an optimistic (SENDING) message by tempId if present,
                  // otherwise fall through to addMessage (deduplication by real id).
                  if (data.tempId) {
                    set(draft => {
                      const msgs = draft.messages[data.message.conversationId]
                      if (msgs) {
                        const optimisticIndex = msgs.findIndex(
                          m => (m as any).idempotencyKey === data.tempId || m.id === data.tempId
                        )
                        if (optimisticIndex !== -1) {
                          msgs.splice(optimisticIndex, 1, data.message)
                          return
                        }
                      }
                      // No optimistic match — add normally (dedup by real id)
                      if (!msgs) {
                        draft.messages[data.message.conversationId] = [data.message]
                      } else if (!msgs.some(m => m.id === data.message.id)) {
                        msgs.push(data.message)
                      }
                    })
                  } else {
                    get().addMessage(data.message)
                  }

                  // Immediately mark incoming message as delivered (best-practice messaging UX)
                  // Only for messages not sent by us.
                  const currentUserId = getCurrentUserId?.() ?? null
                  if (currentUserId && data.message.senderId !== currentUserId) {
                    void get().markAsDelivered(data.message.conversationId, data.message.id)
                  }
                }
              )
            )
          }

          // Phase D: Set up global WebSocket adapter event listeners for typing/presence/receipts
          if (featureFlags.WEBSOCKET_MESSAGES) {
            log('Setting up global WebSocket adapter typing/presence/receipt listeners')

            wsUnsubscribers.push(
              messagingWebSocket.onTypingStart(data => {
                log('Received typing:start via global WebSocket:', data)
                set(draft => {
                  if (!draft.typingUsers[data.conversationId]) {
                    draft.typingUsers[data.conversationId] = []
                  }
                  if (!draft.typingUsers[data.conversationId].includes(data.userId)) {
                    draft.typingUsers[data.conversationId].push(data.userId)
                  }
                })
              })
            )

            wsUnsubscribers.push(
              messagingWebSocket.onTypingStop(data => {
                log('Received typing:stop via global WebSocket:', data)
                set(draft => {
                  if (draft.typingUsers[data.conversationId]) {
                    draft.typingUsers[data.conversationId] = draft.typingUsers[
                      data.conversationId
                    ].filter(id => id !== data.userId)
                  }
                })
              })
            )

            wsUnsubscribers.push(
              messagingWebSocket.onPresenceUpdate(data => {
                log('Received presence:update via global WebSocket:', data)
                set(draft => {
                  const statusMap: Record<string, PresenceStatus> = {
                    online: PresenceStatus.ONLINE,
                    away: PresenceStatus.AWAY,
                    offline: PresenceStatus.OFFLINE,
                    ONLINE: PresenceStatus.ONLINE,
                    AWAY: PresenceStatus.AWAY,
                    OFFLINE: PresenceStatus.OFFLINE,
                  }
                  draft.userPresence[data.userId] = statusMap[data.status] || PresenceStatus.OFFLINE
                })
              })
            )

            wsUnsubscribers.push(
              messagingWebSocket.onReadReceipt(data => {
                log('Received receipt:read via global WebSocket:', data)
                set(draft => {
                  if (data.conversationId && draft.messages[data.conversationId]) {
                    const message = draft.messages[data.conversationId].find(
                      m => m.id === data.messageId
                    )
                    if (message) {
                      message.status = MessageStatus.READ
                      if ('readAt' in data && data.readAt) {
                        ;(message as any).readAt = new Date(data.readAt)
                      }
                    }
                  } else {
                    // Fallback: search all conversations
                    for (const conversationId in draft.messages) {
                      const message = draft.messages[conversationId].find(
                        m => m.id === data.messageId
                      )
                      if (message) {
                        message.status = MessageStatus.READ
                        if ('readAt' in data && data.readAt) {
                          ;(message as any).readAt = new Date(data.readAt)
                        }
                        break
                      }
                    }
                  }
                })
              })
            )
          }

          // ── DELIVERY RECEIPTS (always active, flag-independent) ─────────
          // Emitted by the backend to user:${senderId} directly (not just the
          // conversation room), so the sender sees the double tick regardless of
          // whether WEBSOCKET_MESSAGES is enabled and conversation rooms are joined.
          wsUnsubscribers.push(
            messagingWebSocket.onDeliveredReceipt(data => {
              log('Received receipt:delivered via global WebSocket:', data)
              set(draft => {
                if (data.conversationId && draft.messages[data.conversationId]) {
                  const message = draft.messages[data.conversationId].find(
                    m => m.id === data.messageId
                  )
                  if (message && message.status !== MessageStatus.READ) {
                    message.status = MessageStatus.DELIVERED
                    if ('deliveredAt' in data && data.deliveredAt) {
                      ;(message as any).deliveredAt = new Date(data.deliveredAt)
                    }
                  }
                } else {
                  // Fallback: search all conversations
                  for (const conversationId in draft.messages) {
                    const message = draft.messages[conversationId].find(
                      m => m.id === data.messageId
                    )
                    if (message && message.status !== MessageStatus.READ) {
                      message.status = MessageStatus.DELIVERED
                      if ('deliveredAt' in data && data.deliveredAt) {
                        ;(message as any).deliveredAt = new Date(data.deliveredAt)
                      }
                      break
                    }
                  }
                }
              })
            })
          )

          // ── NEW CONVERSATION notifications (always active) ─────────────
          // When another user creates a conversation that involves us (e.g. a
          // booking user messages our provider organisation), the backend
          // broadcasts a `conversation:new` event to our user room.
          // This listener adds the conversation to our list in real-time so the
          // user does not need to refresh the page.
          wsUnsubscribers.push(
            messagingWebSocket.onConversationNew(
              (data: { conversation: ConversationResponseDto }) => {
                log('Received conversation:new via global WebSocket:', data.conversation?.id)
                if (!data.conversation?.id) return

                const currentUserId = getCurrentUserId?.() ?? null
                const { activeConversationId } = get()

                set(draft => {
                  // Deduplicate: only add if not already in the list
                  const exists = draft.conversations.some(c => c.id === data.conversation.id)
                  if (exists) return

                  // Prepend so the new conversation appears at the top
                  draft.conversations.unshift(data.conversation)
                  log('Added new conversation to list:', data.conversation.id)

                  // Seed the unread badge for an incoming new conversation. The
                  // inline initial message emits no `message:new`, so the
                  // increment handler never fires for it — derive the badge from
                  // the conversation's lastMessage instead.
                  const conv = draft.conversations[0]
                  const lastSenderId = (conv.lastMessage as { senderId?: string } | undefined)
                    ?.senderId
                  if (
                    currentUserId &&
                    conv.id !== activeConversationId &&
                    lastSenderId &&
                    lastSenderId !== currentUserId
                  ) {
                    addViewerUnread(conv, currentUserId, 1)
                  }
                })
              }
            )
          )

          // ── UNREAD COUNT update on new messages (always active) ──────────
          // When a new message arrives we increment unreadCount for the current
          // user's participant in the affected conversation, regardless of whether
          // WEBSOCKET_MESSAGES is enabled. This keeps the per-conversation badge
          // accurate in real-time without a full API refetch.

          // Deduplication set scoped to this initialize() call.
          // The backend (redis-pub-sub.service.ts) emits message:new to BOTH the
          // user's personal room (`user:${id}`) AND the conversation room
          // (`conversation:${id}`).  A participant who has joined the conversation
          // room therefore receives the event twice per message.  The content
          // handler already deduplicates by message ID; this Set applies the same
          // guard to the badge counter so each message only increments unreadCount once.
          const processedForUnread = new Set<string>()

          wsUnsubscribers.push(
            messagingWebSocket.onMessageNew(
              (data: { message: MessageResponseDto; tempId?: string }) => {
                const currentUserId = getCurrentUserId?.() ?? null
                const { activeConversationId } = get()
                const { conversationId, senderId, id: messageId } = data.message

                // Always bump conversation recency + last-message preview so the
                // list reorders to the top for BOTH sent and received messages
                // (the sidebar sorts by lastActivityAt). Idempotent on re-delivery.
                set(draft => {
                  const conversation = draft.conversations.find(c => c.id === conversationId)
                  if (!conversation) return
                  conversation.lastMessage = data.message as any
                  conversation.lastActivityAt = data.message.sentAt as any
                })

                // Unread count only for incoming messages on non-active conversations.
                if (
                  !currentUserId ||
                  senderId === currentUserId ||
                  conversationId === activeConversationId
                ) {
                  return
                }

                // Deduplicate: skip if this message was already counted
                // (backend sends message:new to both user room and conversation room)
                if (processedForUnread.has(messageId)) return
                processedForUnread.add(messageId)
                // Bound the set to prevent memory growth in long-lived sessions
                if (processedForUnread.size > 500) {
                  const entries = Array.from(processedForUnread)
                  entries.slice(0, 250).forEach(id => processedForUnread.delete(id))
                }

                log(
                  'Incrementing unreadCount for conversation:',
                  conversationId,
                  'user:',
                  currentUserId
                )

                set(draft => {
                  const conversation = draft.conversations.find(c => c.id === conversationId)
                  if (!conversation) return

                  // Increment unreadCount for the current user's participant
                  // (find-or-create — provider-org viewers have no real row).
                  addViewerUnread(conversation, currentUserId, 1)
                })
              }
            )
          )

          // Phase 3.2: Initialize message queue for offline support
          if (featureFlags.WEBSOCKET_MESSAGES) {
            log('Initializing message queue for offline support')
            messageQueue.load()

            // Listen for connection restoration to process queue
            wsUnsubscribers.push(
              messagingWebSocket.onConnected(() => {
                if (messagingWebSocket.isConnected() && messageQueue.size > 0) {
                  log(`Processing ${messageQueue.size} queued messages after reconnection`)
                  void messageQueue.processQueue((conversationId, content, tempId) => {
                    messagingWebSocket.sendMessage(conversationId, content, tempId)

                    // Update queued message status back to SENDING
                    set(draft => {
                      for (const convId in draft.messages) {
                        const msg = draft.messages[convId].find(m => m.id === tempId)
                        if (msg) {
                          ;(msg as any).status = 'SENDING'
                          break
                        }
                      }
                    })
                  })
                }
              })
            )
          }

          // Mark as initialized
          set(draft => {
            draft.isInitialized = true
          })

          // Fetch initial conversations
          await get().fetchConversations()

          log('Messaging store initialized successfully')
        } catch (error: any) {
          logError('Failed to initialize messaging store:', error)
          set(draft => {
            draft.isInitialized = true
            draft.conversationsError = error.message || 'Failed to initialize messaging'
          })
        } finally {
          isInitializing = false
        }
      },

      cleanup: () => {
        log('Cleaning up messaging store...')

        // Unsubscribe all WebSocket event listeners registered during initialize().
        // This prevents listener accumulation across login/logout cycles.
        wsUnsubscribers.forEach(unsub => unsub())
        wsUnsubscribers.length = 0
        isInitializing = false

        // Leave any rooms we joined
        if (featureFlags.WEBSOCKET_MESSAGES && messagingWebSocket.isConnected()) {
          for (const conversationId of joinedConversations) {
            messagingWebSocket.leaveConversation(conversationId)
          }
        }
        joinedConversations.clear()

        // Reset state
        set(draft => {
          draft.conversations = []
          draft.activeConversationId = null
          draft.messages = {}
          draft.messagesNextCursor = {}
          draft.messagesHasMore = {}
          draft.isLoadingMoreMessages = {}
          draft.isConnected = false
          draft.typingUsers = {}
          draft.userPresence = {}
          draft.pendingMessages = []
          draft.failedMessages = []
          draft.isLoadingConversations = false
          draft.isLoadingMessages = {}
          draft.conversationsError = null
          draft.messagesError = {}
          draft.rateLimitRetryAfter = null
          draft.isInitialized = false
        })

        log('Messaging store cleaned up')
      },

      // Conversations
      fetchConversations: async () => {
        log('Fetching conversations...')

        set(draft => {
          draft.isLoadingConversations = true
          draft.conversationsError = null
        })

        try {
          // Note: userId is automatically extracted from JWT token on the backend
          // via @CurrentUser decorator, so we don't need to send it
          const response = await conversationsService.getConversations({
            limit: 100,
          })

          if (!response.success) {
            const errorMessage =
              typeof response.data === 'object' && response.data && 'message' in response.data
                ? (response.data as any).message
                : 'Failed to fetch conversations'
            throw new Error(errorMessage)
          }

          // Handle both response formats:
          // 1. Plain array: [ConversationResponseDto, ...]
          // 2. Backend format: { success, message, data: [...], pagination: {...} } (already unwrapped by apiClient)
          let conversations: any[] = []

          if (Array.isArray(response.data)) {
            // Format 1: Plain array (backend returns data directly)
            conversations = response.data
          } else if (
            response.data &&
            typeof response.data === 'object' &&
            'data' in response.data
          ) {
            // Format 2: Paginated format with nested data property
            conversations = Array.isArray(response.data.data) ? response.data.data : []
          } else {
            logError('Unexpected response format:', response.data)
            throw new Error('Invalid response format from server')
          }

          set(draft => {
            draft.conversations = conversations
            draft.isLoadingConversations = false
          })

          // Join rooms for all conversations so delivery receipts can happen
          // as soon as the user is online in the app (not only on open thread).
          joinAllKnownConversations()

          log('Fetched conversations successfully:', {
            count: conversations.length,
            ids: conversations.map(c => c.id),
            conversations: conversations.map(c => ({
              id: c.id,
              type: c.type,
              participantsCount: c.participants?.length,
            })),
          })
        } catch (error: any) {
          logError('Failed to fetch conversations:', error)
          set(draft => {
            draft.isLoadingConversations = false
            draft.conversationsError = error.message || 'Failed to fetch conversations'
          })
        }
      },

      createConversationWithMessage: async params => {
        log('Creating conversation with initial message:', params)

        try {
          // Import ContextType enum for type conversion
          const { ContextType } = await import('../types')

          // Convert string contextType to enum if provided
          let contextTypeEnum: (typeof ContextType)[keyof typeof ContextType] | undefined
          if (params.contextType) {
            contextTypeEnum = ContextType[params.contextType as keyof typeof ContextType]
          }

          const response = await conversationsService.createConversation({
            userId: params.userId,
            participantId: params.participantId,
            participantType: params.participantType,
            contextType: contextTypeEnum,
            contextId: params.contextId,
            initialMessage: params.initialMessage, // ✅ Required
          })

          if (!response.success) {
            const errorMessage =
              typeof response.data === 'object' && response.data && 'message' in response.data
                ? (response.data as any).message
                : 'Failed to create conversation'
            throw new Error(errorMessage)
          }

          const conversation = response.data

          // Add to store
          set(draft => {
            const exists = draft.conversations.some(c => c.id === conversation.id)
            if (!exists) {
              draft.conversations.unshift(conversation)
            }
            // Clear draft conversation after creation
            draft.draftConversation = null
          })

          log('Conversation created successfully:', conversation.id)

          // ✅ Use setActiveConversation to properly activate the conversation
          // This will fetch messages, join WebSocket room, etc.
          get().setActiveConversation(conversation.id)

          return conversation
        } catch (error: any) {
          logError('Failed to create conversation:', error)
          throw error
        }
      },

      setActiveConversation: conversationId => {
        const state = get()

        // Skip if this conversation is already active (prevents unnecessary re-fetching)
        if (state.activeConversationId === conversationId) {
          log('Conversation already active, skipping:', conversationId)
          return
        }

        log('Setting active conversation:', conversationId)

        // Set the active conversation ID immediately
        set(draft => {
          draft.activeConversationId = conversationId
        })

        // Join new conversation room via global WebSocket adapter
        if (conversationId) {
          if (messagingWebSocket.isConnected()) {
            log('WebSocket connected, ensuring joined conversation:', conversationId)
            ensureJoined(conversationId)
          }

          // Immediately zero the unread badge in local state so the UI responds
          // without waiting for a round-trip.
          const currentUserId = getCurrentUserId?.() ?? null
          if (currentUserId) {
            set(draft => {
              const conversation = draft.conversations.find(c => c.id === conversationId)
              if (conversation) {
                const participant = conversation.participants?.find(p => p.userId === currentUserId)
                if (participant) {
                  participant.unreadCount = 0
                  // Opening clears a manual "mark as unread" too.
                  ;(participant as any).manuallyUnread = false
                }
              }
            })
          }

          // Persist the reset to the database so the count stays 0 after a page
          // refresh.  Fire-and-forget: a failure here is non-critical (the count
          // will self-correct on the next fetchConversations call).
          void conversationsService.markAllAsRead(conversationId).catch(err => {
            logError('Failed to mark conversation as read on activate:', conversationId, err)
          })
        }

        // Note: message fetching is handled by the page-level useEffect with an AbortController
      },

      updateConversation: (conversationId, updates) => {
        log('Updating conversation:', conversationId, updates)

        set(draft => {
          const conversation = draft.conversations.find(c => c.id === conversationId)
          if (conversation) {
            Object.assign(conversation, updates)
          }
        })
      },

      setConversationFlags: async (conversationId, flags) => {
        const currentUserId = getCurrentUserId?.() ?? null
        if (!currentUserId) return

        // Optimistically update the current user's participant — the source the
        // sidebar derives pin/star/mute/archive from — snapshotting for rollback.
        const snapshot: Record<string, boolean | undefined> = {}
        set(draft => {
          const participant = draft.conversations
            .find(c => c.id === conversationId)
            ?.participants?.find(p => p.userId === currentUserId)
          if (!participant) return
          for (const key of Object.keys(flags)) {
            snapshot[key] = (participant as any)[key]
            ;(participant as any)[key] = (flags as any)[key]
          }
        })

        try {
          const res = await conversationsService.updateConversationSettings(conversationId, {
            conversationId,
            userId: currentUserId,
            ...flags,
          })
          if (!res.success) {
            throw new Error(
              (res.data as { message?: string })?.message ?? 'Failed to update conversation'
            )
          }
        } catch (error) {
          // Roll the optimistic change back to the snapshotted values.
          set(draft => {
            const participant = draft.conversations
              .find(c => c.id === conversationId)
              ?.participants?.find(p => p.userId === currentUserId)
            if (!participant) return
            for (const key of Object.keys(snapshot)) {
              ;(participant as any)[key] = snapshot[key]
            }
          })
          throw error
        }
      },

      markConversationUnread: async conversationId => {
        const currentUserId = getCurrentUserId?.() ?? null
        if (!currentUserId) return

        // Optimistically flag the current user's participant as manually unread.
        set(draft => {
          const participant = draft.conversations
            .find(c => c.id === conversationId)
            ?.participants?.find(p => p.userId === currentUserId)
          if (participant) (participant as any).manuallyUnread = true
        })

        try {
          const res = await conversationsService.markConversationUnread(conversationId)
          if (!res.success) {
            throw new Error(
              (res.data as { message?: string })?.message ?? 'Failed to mark conversation unread'
            )
          }
        } catch (error) {
          set(draft => {
            const participant = draft.conversations
              .find(c => c.id === conversationId)
              ?.participants?.find(p => p.userId === currentUserId)
            if (participant) (participant as any).manuallyUnread = false
          })
          throw error
        }
      },

      markConversationRead: async conversationId => {
        const currentUserId = getCurrentUserId?.() ?? null
        if (!currentUserId) return

        // Optimistically clear unread state for the current user's participant.
        set(draft => {
          const participant = draft.conversations
            .find(c => c.id === conversationId)
            ?.participants?.find(p => p.userId === currentUserId)
          if (participant) {
            participant.unreadCount = 0
            ;(participant as any).manuallyUnread = false
          }
        })

        // Persist via the existing mark-read endpoint. A failure self-corrects on
        // the next fetch, so we don't roll the optimistic clear back.
        await conversationsService.markAllAsRead(conversationId)
      },

      setDraftConversation: metadata => {
        log('Setting draft conversation:', metadata)
        set(draft => {
          draft.draftConversation = metadata
          // Clear active conversation when setting draft (WhatsApp Web pattern)
          draft.activeConversationId = null
        })
      },

      clearDraftConversation: () => {
        log('Clearing draft conversation')
        set(draft => {
          draft.draftConversation = null
        })
      },

      // Messages
      fetchMessages: async (conversationId, signal) => {
        log('Fetching messages for conversation:', conversationId)

        set(draft => {
          draft.isLoadingMessages[conversationId] = true
          draft.messagesError[conversationId] = null
        })

        try {
          const response = await messagesService.getMessages({
            conversationId,
            limit: 50,
            signal,
          })

          if (!response.success) {
            const errorMessage =
              typeof response.data === 'object' && response.data && 'message' in response.data
                ? (response.data as any).message
                : 'Failed to fetch messages'
            throw new Error(errorMessage)
          }

          // Validate response structure
          if (!response.data) {
            throw new Error('Invalid API response: missing data')
          }

          // Backend returns PaginatedMessagesResponseDto: { data: messages[], nextCursor, hasMore }
          const paginatedResponse = response.data
          // Server returns newest-first (DESC) for the initial load so the client always
          // sees the most recent messages. Reverse here for oldest-at-top display order.
          const messages = Array.isArray(paginatedResponse.data)
            ? [...paginatedResponse.data].reverse()
            : []

          set(draft => {
            draft.messages[conversationId] = messages
            draft.messagesNextCursor[conversationId] = paginatedResponse.nextCursor ?? null
            draft.messagesHasMore[conversationId] = paginatedResponse.hasMore ?? false
            draft.isLoadingMessages[conversationId] = false
          })

          log('Fetched messages successfully:', {
            count: messages.length,
            hasMore: paginatedResponse.hasMore,
            nextCursor: paginatedResponse.nextCursor,
          })
        } catch (error: any) {
          // Swallow abort/cancel errors — the fetch was intentionally cancelled.
          // Also handle the case where the API client wraps the Axios CanceledError into a
          // plain Error with message 'canceled', losing the original name in the process.
          // `signal?.aborted` is the definitive check when name/message checks are ambiguous.
          if (
            error?.name === 'AbortError' ||
            error?.name === 'CanceledError' ||
            error?.message === 'canceled' ||
            signal?.aborted
          ) {
            set(draft => {
              draft.isLoadingMessages[conversationId] = false
            })
            return
          }
          logError('Failed to fetch messages:', error)
          set(draft => {
            draft.isLoadingMessages[conversationId] = false
            draft.messagesError[conversationId] = error.message || 'Failed to fetch messages'
          })
        }
      },

      fetchMoreMessages: async conversationId => {
        const state = get()
        const nextCursor = state.messagesNextCursor[conversationId]
        const hasMore = state.messagesHasMore[conversationId]
        if (!nextCursor || !hasMore) {
          log('No more messages to load for conversation:', conversationId)
          return
        }

        log('Loading older messages for conversation:', conversationId, 'cursor:', nextCursor)

        set(draft => {
          draft.isLoadingMoreMessages[conversationId] = true
        })

        try {
          const response = await messagesService.getMessages({
            conversationId,
            cursor: nextCursor,
            direction: 'before',
            limit: 50,
          })

          if (!response.success) {
            const errorMessage =
              typeof response.data === 'object' && response.data && 'message' in response.data
                ? (response.data as any).message
                : 'Failed to load older messages'
            throw new Error(errorMessage)
          }

          const paginatedResponse = response.data
          const newMessages = Array.isArray(paginatedResponse?.data) ? paginatedResponse.data : []

          set(draft => {
            const existing = draft.messages[conversationId] ?? []
            // Backend returns "before" batch in descending order (newest of batch first); prepend oldest first
            const combined = [...newMessages.reverse(), ...existing]
            draft.messages[conversationId] = combined
            draft.messagesNextCursor[conversationId] = paginatedResponse?.nextCursor ?? null
            draft.messagesHasMore[conversationId] = paginatedResponse?.hasMore ?? false
            draft.isLoadingMoreMessages[conversationId] = false
          })

          log('Loaded older messages:', {
            count: newMessages.length,
            hasMore: paginatedResponse?.hasMore,
          })
        } catch (error: unknown) {
          // If the cursor message was deleted (e.g. moderation), the server returns
          // CURSOR_NOT_FOUND. Reset to page 1 instead of showing a blank error.
          const isCursorGone =
            error instanceof Error &&
            (error.message.includes('CURSOR_NOT_FOUND') || error.message.includes('400'))

          if (isCursorGone) {
            logError('Cursor message deleted — resetting to page 1 for:', conversationId)
            set(draft => {
              draft.messagesNextCursor[conversationId] = null
              draft.messagesHasMore[conversationId] = false
              draft.isLoadingMoreMessages[conversationId] = false
            })
            // Fetch fresh first page
            get().fetchMessages(conversationId)
          } else {
            logError('Failed to load older messages:', error)
            set(draft => {
              draft.isLoadingMoreMessages[conversationId] = false
            })
          }
        }
      },

      sendMessage: async dto => {
        log('Sending message:', dto)

        // Create optimistic message
        const optimisticMessage: OptimisticMessage = {
          id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          conversationId: dto.conversationId,
          senderId: dto.senderId,
          senderType: dto.senderType,
          content: dto.content,
          status: 'SENDING',
          sentAt: new Date(),
          isOptimistic: true,
          idempotencyKey: dto.idempotencyKey || `${dto.senderId}-${Date.now()}`,
        }

        // Add optimistic message to store (cast to unknown first to avoid type error)
        set(draft => {
          if (!draft.messages[dto.conversationId]) {
            draft.messages[dto.conversationId] = []
          }
          draft.messages[dto.conversationId].push(
            optimisticMessage as unknown as MessageResponseDto
          )
          draft.pendingMessages.push(optimisticMessage)

          // Bump conversation recency so the conversation reorders to the top of
          // the list immediately on send (the sidebar sorts by lastActivityAt).
          // The sender does not always receive their own message:new echo, so we
          // cannot rely on it; the server reconciles on the next fetch.
          const conversation = draft.conversations.find(c => c.id === dto.conversationId)
          if (conversation) {
            conversation.lastMessage = optimisticMessage as unknown as MessageResponseDto
            conversation.lastActivityAt = optimisticMessage.sentAt as any
          }
        })

        try {
          // ✅ Phase 3: Route message via WebSocket when feature flag enabled and connected
          const useWebSocket =
            featureFlags.WEBSOCKET_MESSAGES &&
            messagingWebSocket &&
            messagingWebSocket.isConnected()

          if (useWebSocket) {
            // ✅ Send via WebSocket (fire-and-forget)
            // Server will confirm via message:created event or report via message:error event
            log('Sending message via WebSocket:', optimisticMessage.id)
            messagingWebSocket.sendMessage(dto.conversationId, dto.content, optimisticMessage.id, {
              attachmentIds: dto.attachmentIds,
            })
            // Note: Optimistic message replacement is handled by the message:created event listener
            // set up in initialize(). No need to await here.
          } else if (
            featureFlags.WEBSOCKET_MESSAGES &&
            messagingWebSocket &&
            !messagingWebSocket.isConnected()
          ) {
            // WebSocket enabled but disconnected
            if (featureFlags.WEBSOCKET_FALLBACK_TO_HTTP) {
              // ✅ Fallback to HTTP
              log('WebSocket disconnected, falling back to HTTP for:', optimisticMessage.id)
              await get().sendMessageViaHttp(dto, optimisticMessage)
            } else {
              // ❌ No fallback - queue the message for later delivery
              log('WebSocket disconnected, queueing message:', optimisticMessage.id)
              messageQueue.enqueue(dto.conversationId, dto.content, optimisticMessage.id)
              set(draft => {
                const messages = draft.messages[dto.conversationId]
                if (messages) {
                  const msg = messages.find(m => m.id === optimisticMessage.id)
                  if (msg) {
                    ;(msg as any).status = 'QUEUED'
                  }
                }
              })
            }
          } else {
            // ✅ Feature flag disabled - use HTTP (existing behavior)
            await get().sendMessageViaHttp(dto, optimisticMessage)
          }
        } catch (error: any) {
          logError('Failed to send message:', error)

          // Mark message as failed
          const failedMessage: FailedMessage = {
            ...optimisticMessage,
            status: 'FAILED',
            error: error.message || 'Failed to send message',
            retryCount: 0,
            lastRetryAt: null,
          }

          set(draft => {
            const messages = draft.messages[dto.conversationId]
            if (messages) {
              const index = messages.findIndex(m => m.id === optimisticMessage.id)
              if (index !== -1) {
                messages[index] = failedMessage as unknown as MessageResponseDto
              }
            }
            draft.pendingMessages = draft.pendingMessages.filter(m => m.id !== optimisticMessage.id)
            draft.failedMessages.push(failedMessage)
          })
        }
      },

      /**
       * Send a message via HTTP (fallback or default behavior)
       * Extracted to allow reuse from sendMessage and message queue processing
       */
      sendMessageViaHttp: async (dto: SendMessageDto, optimisticMessage: OptimisticMessage) => {
        log('Sending message via HTTP:', optimisticMessage.id)

        const response = await messagesService.sendMessage(dto)

        if (!response.success) {
          const data = response.data as
            | { message?: string; retryAfter?: number; statusCode?: number }
            | undefined
          const errorMessage =
            data && typeof data === 'object' && 'message' in data
              ? (data.message as string)
              : 'Failed to send message'
          if (
            data?.retryAfter != null &&
            (data.statusCode === 429 || String(data.statusCode) === '429')
          ) {
            set(draft => {
              draft.rateLimitRetryAfter = typeof data.retryAfter === 'number' ? data.retryAfter : 60
            })
            const err = new Error(errorMessage) as Error & { retryAfter?: number }
            err.retryAfter = typeof data.retryAfter === 'number' ? data.retryAfter : 60
            throw err
          }
          throw new Error(errorMessage)
        }

        set(draft => {
          draft.rateLimitRetryAfter = null
        })

        const sentMessage = response.data

        // Replace optimistic message with real message
        set(draft => {
          const messages = draft.messages[dto.conversationId]
          if (messages) {
            const optimisticIndex = messages.findIndex(m => m.id === optimisticMessage.id)
            const realMessageIndex = messages.findIndex(m => m.id === sentMessage.id)

            // If the real message already exists (from WebSocket), just remove the optimistic one
            if (realMessageIndex !== -1) {
              if (optimisticIndex !== -1) {
                messages.splice(optimisticIndex, 1)
              }
            } else if (optimisticIndex !== -1) {
              // Otherwise, replace the optimistic message with the real one
              messages[optimisticIndex] = sentMessage
            } else {
              // Edge case: optimistic message not found, add the real message
              messages.push(sentMessage)
            }
          }
          draft.pendingMessages = draft.pendingMessages.filter(m => m.id !== optimisticMessage.id)
        })

        log('Message sent via HTTP successfully:', sentMessage.id)
      },

      addMessage: message => {
        log('Adding message to store:', message.id)

        set(draft => {
          if (!draft.messages[message.conversationId]) {
            draft.messages[message.conversationId] = []
          }

          // Check if message already exists (avoid duplicates)
          const exists = draft.messages[message.conversationId].some(m => m.id === message.id)
          if (!exists) {
            draft.messages[message.conversationId].push(message)
          }

          // Update conversation's last message (ConversationResponseDto has lastMessage, not lastMessageAt)
          const conversation = draft.conversations.find(c => c.id === message.conversationId)
          if (conversation) {
            conversation.lastMessageId = message.id
            conversation.messageCount = (conversation.messageCount || 0) + 1
          }
        })
      },

      updateMessage: (messageId, updates) => {
        log('Updating message:', messageId, updates)

        set(draft => {
          // Find the message in all conversations
          for (const conversationId in draft.messages) {
            const messages = draft.messages[conversationId]
            const message = messages.find(m => m.id === messageId)
            if (message) {
              Object.assign(message, updates)
              break
            }
          }
        })
      },

      deleteMessage: (conversationId, messageId) => {
        log('Deleting message:', messageId)

        set(draft => {
          if (draft.messages[conversationId]) {
            draft.messages[conversationId] = draft.messages[conversationId].filter(
              m => m.id !== messageId
            )
          }
        })
      },

      // Real-time features
      markAsRead: async (conversationId, messageId) => {
        log('Marking message as read:', messageId)

        try {
          // Send read receipt via global WebSocket adapter
          if (featureFlags.WEBSOCKET_MESSAGES && messagingWebSocket.isConnected()) {
            messagingWebSocket.markAsRead(messageId, conversationId)
          }

          // Also call API endpoint (markAsRead expects id and dto)
          const userId = getCurrentUserId?.() ?? null
          if (userId) {
            await messagesService.markAsRead(messageId, { messageId, userId })
          } else {
            log('Skipping HTTP markAsRead because userId is missing')
          }

          // Optimistically update local state so the UI reflects READ immediately,
          // regardless of whether a WS receipt:read event arrives (e.g. when
          // WEBSOCKET_MESSAGES flag is off or the WS connection is down).
          const now = new Date()
          set(draft => {
            const msgs = draft.messages[conversationId]
            if (msgs) {
              const message = msgs.find(m => m.id === messageId)
              if (message) {
                message.status = MessageStatus.READ
                ;(message as any).readAt = now
              }
            }
          })

          log('Message marked as read successfully')
        } catch (error: any) {
          logError('Failed to mark message as read:', error)
        }
      },

      markAsDelivered: async (conversationId, messageId, deliveryLatencyMs) => {
        log('Marking message as delivered:', messageId)

        try {
          // Send delivery receipt via global WebSocket adapter
          if (featureFlags.WEBSOCKET_MESSAGES && messagingWebSocket.isConnected()) {
            messagingWebSocket.markAsDelivered(messageId, conversationId, deliveryLatencyMs)
          }

          // Also call API endpoint (markAsDelivered expects id and dto)
          const userId = getCurrentUserId?.() ?? null
          if (userId) {
            await messagesService.markAsDelivered(messageId, { messageId, userId })
          } else {
            log('Skipping HTTP markAsDelivered because userId is missing')
          }

          log('Message marked as delivered successfully')
        } catch (error: any) {
          logError('Failed to mark message as delivered:', error)
        }
      },

      startTyping: conversationId => {
        log('Starting typing indicator:', conversationId)

        // Send typing indicator via global WebSocket adapter
        if (featureFlags.WEBSOCKET_MESSAGES && messagingWebSocket.isConnected()) {
          messagingWebSocket.startTyping(conversationId)
        }
      },

      stopTyping: conversationId => {
        log('Stopping typing indicator:', conversationId)

        // Stop typing indicator via global WebSocket adapter
        if (featureFlags.WEBSOCKET_MESSAGES && messagingWebSocket.isConnected()) {
          messagingWebSocket.stopTyping(conversationId)
        }
      },

      // Offline support
      retryFailedMessages: async () => {
        log('Retrying all failed messages...')

        const state = get()
        const failedMessages = [...state.failedMessages]

        for (const failedMessage of failedMessages) {
          await get().retryFailedMessage(failedMessage.id)
        }
      },

      retryFailedMessage: async messageId => {
        log('Retrying failed message:', messageId)

        const state = get()
        const failedMessage = state.failedMessages.find(m => m.id === messageId)

        if (!failedMessage) {
          logError('Failed message not found:', messageId)
          return
        }

        // Remove from failed messages
        set(draft => {
          draft.failedMessages = draft.failedMessages.filter(m => m.id !== messageId)
        })

        // Retry sending (FailedMessage only has basic fields from OptimisticMessage)
        const dto: SendMessageDto = {
          conversationId: failedMessage.conversationId,
          senderId: failedMessage.senderId,
          senderType: failedMessage.senderType,
          content: failedMessage.content,
          idempotencyKey: failedMessage.idempotencyKey,
        }

        await get().sendMessage(dto)
      },

      removeFailedMessage: messageId => {
        log('Removing failed message:', messageId)

        set(draft => {
          draft.failedMessages = draft.failedMessages.filter(m => m.id !== messageId)

          // Also remove from messages
          for (const conversationId in draft.messages) {
            draft.messages[conversationId] = draft.messages[conversationId].filter(
              m => m.id !== messageId
            )
          }
        })
      },

      // Error handling
      clearConversationsError: () => {
        set(draft => {
          draft.conversationsError = null
        })
      },

      clearMessagesError: conversationId => {
        set(draft => {
          draft.messagesError[conversationId] = null
        })
      },

      clearRateLimitRetryAfter: () => {
        set(draft => {
          draft.rateLimitRetryAfter = null
        })
      },

      reportMessage: async (messageId, dto) => {
        const userId = getCurrentUserId?.()
        if (!userId) {
          return { success: false, error: 'Not authenticated' }
        }
        try {
          const response = await messagesService.reportMessage(messageId, {
            messageId,
            reportedBy: userId,
            reason: dto.reason as import('../types').ReportReason,
            description: dto.description,
          })
          if (!response.success) {
            const err =
              typeof response.data === 'object' && response.data && 'message' in response.data
                ? (response.data as { message: string }).message
                : 'Failed to submit report'
            return { success: false, error: err }
          }
          return { success: true }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Failed to submit report'
          logError('Report message failed:', error)
          return { success: false, error: message }
        }
      },
    }))
  )

  return { useMessagingStore }
}
