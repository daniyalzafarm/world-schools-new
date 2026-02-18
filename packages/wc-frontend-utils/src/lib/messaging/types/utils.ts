/**
 * Messaging System Utility Types
 *
 * Helper types for pagination, filtering, sorting, and conditional features.
 *
 * @module messaging/types/utils
 */

import type { ConversationStatus, ConversationType, SenderType } from './enums'

// ============================================
// Pagination Types
// ============================================

/**
 * Cursor-based pagination parameters
 */
export interface CursorPaginationParams {
  cursor?: string
  limit?: number
  direction?: 'before' | 'after'
}

/**
 * Offset-based pagination parameters
 */
export interface OffsetPaginationParams {
  offset?: number
  limit?: number
}

/**
 * Cursor-based pagination result
 */
export interface CursorPaginationResult<T> {
  data: T[]
  nextCursor: string | null
  hasMore: boolean
}

/**
 * Offset-based pagination result
 */
export interface OffsetPaginationResult<T> {
  data: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

// ============================================
// Filtering Types
// ============================================

/**
 * Conversation filter options
 */
export interface ConversationFilters {
  type?: ConversationType
  status?: ConversationStatus
  filter?: 'all' | 'unread' | 'archived' | 'starred' | 'pinned'
  providerId?: string
  userId?: string
  search?: string
}

/**
 * Message filter options
 */
export interface MessageFilters {
  conversationId: string
  senderId?: string
  senderType?: SenderType
  search?: string
  hasAttachments?: boolean
  isPinned?: boolean
  isBookmarked?: boolean
}

// ============================================
// Sorting Types
// ============================================

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc'

/**
 * Conversation sort options
 */
export interface ConversationSortOptions {
  field: 'lastActivityAt' | 'createdAt' | 'messageCount' | 'unreadCount'
  direction: SortDirection
}

/**
 * Message sort options
 */
export interface MessageSortOptions {
  field: 'sentAt' | 'createdAt'
  direction: SortDirection
}

// ============================================
// Provider-Specific Types
// ============================================

/**
 * Provider conversation assignment status
 */
export type AssignmentStatus = 'unassigned' | 'assigned_to_me' | 'assigned_to_others'

/**
 * Provider conversation with assignment info
 */
export interface ProviderConversationInfo {
  conversationId: string
  assignmentStatus: AssignmentStatus
  assignedToUserId: string | null
  assignedToUserName: string | null
  canReply: boolean
}

// ============================================
// WebSocket Event Types
// ============================================

/**
 * WebSocket event payload for new message
 */
export interface NewMessageEvent {
  conversationId: string
  message: any // MessageResponseDto
}

/**
 * WebSocket event payload for message delivered
 */
export interface MessageDeliveredEvent {
  messageId: string
  userId: string
  deliveredAt: Date
}

/**
 * WebSocket event payload for message read
 */
export interface MessageReadEvent {
  messageId: string
  userId: string
  readAt: Date
}

/**
 * WebSocket event payload for typing indicator
 */
export interface TypingEvent {
  conversationId: string
  userId: string
  isTyping: boolean
}

/**
 * WebSocket event payload for presence update
 */
export interface PresenceUpdateEvent {
  userId: string
  status: 'ONLINE' | 'AWAY' | 'OFFLINE'
  lastSeenAt?: Date
}

// ============================================
// Optimistic Update Types
// ============================================

/**
 * Optimistic message for UI updates before server confirmation
 */
export interface OptimisticMessage {
  id: string // Temporary ID
  conversationId: string
  senderId: string
  senderType: SenderType
  content: string
  status: 'SENDING'
  sentAt: Date
  isOptimistic: true
  idempotencyKey: string
}

/**
 * Failed message for retry queue
 */
export interface FailedMessage extends OptimisticMessage {
  status: 'FAILED'
  error: string
  retryCount: number
  lastRetryAt: Date | null
}
