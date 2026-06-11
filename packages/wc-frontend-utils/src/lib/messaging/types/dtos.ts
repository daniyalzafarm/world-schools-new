/**
 * Messaging System DTOs (Data Transfer Objects)
 *
 * TypeScript interfaces matching the backend DTOs.
 * These types are used for API requests and responses.
 *
 * @module messaging/types/dtos
 */

import type {
  ConversationType,
  ConversationStatus,
  ContextType,
  SenderType,
  ContentType,
  MessagePriority,
  DeletionType,
  ReportReason,
  ReportStatus,
  MessageType,
  MessageStatus,
} from './enums'
import type { MessageAttachmentSummary } from './models'

// ============================================
// Request DTOs - Messages
// ============================================

/**
 * DTO for sending a new message
 */
export interface SendMessageDto {
  conversationId: string
  senderId: string
  senderType: SenderType
  content: string
  contentType?: ContentType
  attachmentIds?: string[]
  replyToId?: string
  priority?: MessagePriority
  scheduledFor?: Date
  idempotencyKey: string
}

/**
 * DTO for getting messages with pagination
 */
export interface GetMessagesDto {
  conversationId: string
  limit?: number
  cursor?: string
  direction?: 'before' | 'after'
  /** AbortSignal for cancelling in-flight requests — stripped from query params */
  signal?: AbortSignal
}

/**
 * DTO for editing a message
 */
export interface EditMessageDto {
  messageId: string
  userId: string
  newContent: string
  editReason?: string
}

/**
 * DTO for deleting a message
 */
export interface DeleteMessageDto {
  messageId: string
  userId: string
  deletionType?: DeletionType
}

/**
 * DTO for marking a message as read
 */
export interface MarkAsReadDto {
  messageId: string
  userId: string
}

/**
 * DTO for marking a message as delivered
 */
export interface MarkAsDeliveredDto {
  messageId: string
  userId: string
}

/**
 * DTO for adding a reaction to a message
 */
export interface AddReactionDto {
  messageId: string
  userId: string
  emoji: string
}

/**
 * DTO for removing a reaction from a message
 */
export interface RemoveReactionDto {
  messageId: string
  userId: string
  emoji: string
}

/**
 * DTO for bookmarking a message
 */
export interface BookmarkMessageDto {
  messageId: string
  userId: string
  note?: string
}

/**
 * DTO for removing a bookmark from a message
 */
export interface UnbookmarkMessageDto {
  messageId: string
  userId: string
}

/**
 * DTO for pinning a message
 */
export interface PinMessageDto {
  messageId: string
  userId: string
}

/**
 * DTO for unpinning a message
 */
export interface UnpinMessageDto {
  messageId: string
  userId: string
}

/**
 * DTO for forwarding a message
 */
export interface ForwardMessageDto {
  messageId: string
  toConversationId: string
  forwardedBy: string
}

/**
 * DTO for scheduling a message
 */
export interface ScheduleMessageDto {
  conversationId: string
  senderId: string
  content: string
  scheduledFor: Date
  scheduledBy: string
}

/**
 * DTO for reporting a message
 */
export interface ReportMessageDto {
  messageId: string
  reportedBy: string
  reason: ReportReason
  description?: string
}

// ============================================
// Request DTOs - Conversations
// ============================================

/**
 * DTO for creating a new conversation
 *
 * IMPORTANT: Initial message is REQUIRED
 * - Conversations are only created when the user sends the first message
 * - This prevents empty conversations from cluttering the conversation list
 * - Follows industry best practices (WhatsApp, Slack, Discord)
 */
export interface CreateConversationDto {
  userId: string
  participantId: string
  participantType: 'provider' | 'superadmin'
  contextType?: ContextType
  contextId?: string
  initialMessage: string // ✅ Required (no longer optional)
  subject?: string
}

/**
 * DTO for getting conversations with filters
 *
 * Note: userId is optional because it's automatically extracted from the
 * authenticated user's JWT token on the backend via @CurrentUser decorator.
 * Frontend applications should NOT send userId in the request.
 */
export interface GetConversationsDto {
  userId?: string
  filter?: 'all' | 'unread' | 'archived' | 'starred' | 'pinned'
  status?: ConversationStatus
  type?: ConversationType
  limit?: number
  offset?: number
  providerId?: string // For provider app filtering
}

/**
 * DTO for updating conversation participant settings
 */
export interface UpdateConversationSettingsDto {
  conversationId: string
  userId: string
  pinned?: boolean
  starred?: boolean
  muted?: boolean
  archived?: boolean
}

/**
 * DTO for assigning a conversation to a user
 */
export interface AssignConversationDto {
  conversationId: string
  assignedToUserId: string
  assignedBy: string
}

/**
 * DTO for updating conversation status
 */
export interface UpdateConversationStatusDto {
  conversationId: string
  status: ConversationStatus
  userId: string
}

/**
 * DTO for adding a label to a conversation
 */
export interface AddLabelDto {
  conversationId: string
  labelId: string
}

/**
 * DTO for removing a label from a conversation
 */
export interface RemoveLabelDto {
  conversationId: string
  labelId: string
}

/**
 * DTO for creating a conversation label
 */
export interface CreateLabelDto {
  name: string
  color?: string
}

/**
 * DTO for conversation metrics
 */
export interface ConversationMetricsDto {
  totalMessages: number
  unreadMessages: number
  lastActivityAt: Date
  averageResponseTime?: number
}

// ============================================
// Response DTOs
// ============================================

/**
 * Response DTO for user information
 */
export interface UserResponseDto {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  /** SAS-resolved profile photo URL (null when unset). */
  profilePhotoUrl?: string | null
}

/**
 * Response DTO for provider information
 */
export interface ProviderResponseDto {
  id: string
  legalCompanyName: string | null
  email: string | null
}

/**
 * Response DTO for conversation participant
 */
export interface ParticipantResponseDto {
  id: string
  conversationId: string
  userId: string
  providerId: string | null
  pinned: boolean
  starred: boolean
  muted: boolean
  archived: boolean
  unreadCount: number
  lastReadAt: Date | null
  joinedAt: Date
  user?: UserResponseDto
  provider?: ProviderResponseDto
}

/**
 * Response DTO for message
 */
export interface MessageResponseDto {
  id: string
  conversationId: string
  senderId: string
  senderType: SenderType
  content: string
  contentType: ContentType
  attachments: MessageAttachmentSummary[] | null
  type: MessageType
  metadata: any | null
  replyToId: string | null
  forwardedFromId: string | null
  forwardCount: number
  isPinned: boolean
  pinnedAt: Date | null
  pinnedBy: string | null
  priority: MessagePriority | null
  scheduledFor: Date | null
  scheduledBy: string | null
  isScheduled: boolean
  status: MessageStatus
  deliveredAt: Date | null
  readAt: Date | null
  sentAt: Date
  deliveryLatencyMs: number | null
  editedAt: Date | null
  deletedAt: Date | null
  deletedBy: string | null
  isDeleted: boolean
  deletionType: DeletionType | null
  createdAt: Date
  updatedAt: Date
  sender?: UserResponseDto
  replyTo?: Partial<MessageResponseDto>
  readReceipts?: ReadReceiptResponseDto[]
  deliveryReceipts?: DeliveryReceiptResponseDto[]
  reactions?: ReactionResponseDto[]
  mentions?: MentionResponseDto[]
  editHistory?: EditHistoryResponseDto[]
}

/**
 * Response DTO for conversation
 */
export interface ConversationResponseDto {
  id: string
  type: ConversationType
  subject: string | null
  contextType: ContextType | null
  contextId: string | null
  // Camp identity for camp-/booking-context conversations, enriched server-side
  // so the UI can show the camp (name/location/photo) instead of the operator org.
  campName?: string | null
  campLocation?: string | null
  campPhotoUrl?: string | null
  metadata: any | null
  assignedToUserId: string | null
  assignedAt: Date | null
  assignedBy: string | null
  status: ConversationStatus
  openedAt: Date
  statusChangedAt: Date | null
  statusChangedByUser: string | null
  messageCount: number
  participantCount: number
  avgResponseTime: number | null
  lastActivityAt: Date
  createdAt: Date
  updatedAt: Date
  lastMessageId: string | null
  participants?: ParticipantResponseDto[]
  lastMessage?: MessageResponseDto
  labels?: LabelAssignmentResponseDto[]
}

/**
 * Response DTO for paginated conversations
 */
export interface PaginatedConversationsResponseDto {
  data: ConversationResponseDto[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

/**
 * Response DTO for paginated messages
 */
export interface PaginatedMessagesResponseDto {
  data: MessageResponseDto[]
  nextCursor: string | null
  hasMore: boolean
}

/**
 * Response DTO for read receipt
 */
export interface ReadReceiptResponseDto {
  id: string
  messageId: string
  userId: string
  readAt: Date
  user?: UserResponseDto
}

/**
 * Response DTO for delivery receipt
 */
export interface DeliveryReceiptResponseDto {
  id: string
  messageId: string
  userId: string
  deliveredAt: Date
  user?: UserResponseDto
}

/**
 * Response DTO for message reaction
 */
export interface ReactionResponseDto {
  id: string
  messageId: string
  userId: string
  emoji: string
  createdAt: Date
  user?: UserResponseDto
}

/**
 * Response DTO for message mention
 */
export interface MentionResponseDto {
  id: string
  messageId: string
  userId: string
  position: number | null
  createdAt: Date
  user?: UserResponseDto
}

/**
 * Response DTO for message edit history
 */
export interface EditHistoryResponseDto {
  id: string
  messageId: string
  previousContent: string
  editedBy: string
  editedAt: Date
  editReason: string | null
  editor?: UserResponseDto
}

/**
 * Response DTO for message bookmark
 */
export interface BookmarkResponseDto {
  id: string
  messageId: string
  userId: string
  note: string | null
  createdAt: Date
  message?: MessageResponseDto
}

/**
 * Response DTO for conversation label
 */
export interface LabelResponseDto {
  id: string
  name: string
  color: string | null
  createdAt: Date
}

/**
 * Response DTO for label assignment
 */
export interface LabelAssignmentResponseDto {
  conversationId: string
  labelId: string
  assignedBy: string
  assignedAt: Date
  label?: LabelResponseDto
}

/**
 * Response DTO for message report
 */
export interface ReportResponseDto {
  id: string
  messageId: string
  reportedBy: string
  reason: ReportReason
  description: string | null
  status: ReportStatus
  reviewedBy: string | null
  reviewedAt: Date | null
  reviewNotes: string | null
  createdAt: Date
  updatedAt: Date
  message?: MessageResponseDto
  reporter?: UserResponseDto
  reviewer?: UserResponseDto
}

/**
 * Response DTO for search results
 */
export interface SearchResultsResponseDto {
  messages: MessageResponseDto[]
  total: number
  query: string
  limit: number
  offset: number
}

/**
 * Response DTO for conversation metrics
 */
export interface ConversationMetricsResponseDto {
  totalMessages: number
  unreadMessages: number
  lastActivityAt: Date
  averageResponseTime: number | null
}

/**
 * Generic success response
 */
export interface SuccessResponseDto {
  success: boolean
  message?: string
}

/**
 * Generic error response
 */
export interface ErrorResponseDto {
  success: false
  error: string
  message: string
  statusCode: number
}
