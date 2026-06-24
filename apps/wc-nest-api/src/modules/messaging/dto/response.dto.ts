import type {
  ContentType,
  ContextType,
  ConversationStatus,
  ConversationType,
  DeletionType,
  MessagePriority,
  MessageStatus,
  MessageType,
  ReportReason,
  ReportStatus,
  SenderType,
} from '../../../generated/client/client'

/**
 * Response DTO for user information
 */
export class UserResponseDto {
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
export class ProviderResponseDto {
  id: string
  legalCompanyName: string | null
  email: string | null
}

/**
 * Response DTO for conversation participant
 */
export class ParticipantResponseDto {
  id: string
  conversationId: string
  userId: string
  providerId: string | null
  pinned: boolean
  starred: boolean
  muted: boolean
  archived: boolean
  unreadCount: number
  manuallyUnread: boolean
  lastReadAt: Date | null
  joinedAt: Date
  user?: UserResponseDto
  provider?: ProviderResponseDto
}

/**
 * Response DTO for message
 */
export class MessageResponseDto {
  id: string
  conversationId: string
  senderId: string
  senderType: SenderType
  content: string
  contentType: ContentType
  attachments: any | null
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
export class ConversationResponseDto {
  id: string
  type: ConversationType
  subject: string | null
  contextType: ContextType | null
  contextId: string | null
  metadata: any | null
  assignedToId: string | null
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
export class PaginatedConversationsResponseDto {
  data: ConversationResponseDto[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

/**
 * Response DTO for paginated messages
 */
export class PaginatedMessagesResponseDto {
  data: MessageResponseDto[]
  nextCursor: string | null
  hasMore: boolean
}

/**
 * Response DTO for read receipt
 */
export class ReadReceiptResponseDto {
  id: string
  messageId: string
  userId: string
  readAt: Date
  user?: UserResponseDto
}

/**
 * Response DTO for delivery receipt
 */
export class DeliveryReceiptResponseDto {
  id: string
  messageId: string
  userId: string
  deliveredAt: Date
  user?: UserResponseDto
}

/**
 * Response DTO for message reaction
 */
export class ReactionResponseDto {
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
export class MentionResponseDto {
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
export class EditHistoryResponseDto {
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
export class BookmarkResponseDto {
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
export class LabelResponseDto {
  id: string
  name: string
  color: string | null
  createdAt: Date
}

/**
 * Response DTO for label assignment
 */
export class LabelAssignmentResponseDto {
  conversationId: string
  labelId: string
  assignedBy: string
  assignedAt: Date
  label?: LabelResponseDto
}

/**
 * Response DTO for message report
 */
export class ReportResponseDto {
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
export class SearchResultsResponseDto {
  messages: MessageResponseDto[]
  total: number
  query: string
  limit: number
  offset: number
}

/**
 * Response DTO for conversation metrics
 */
export class ConversationMetricsResponseDto {
  totalMessages: number
  unreadMessages: number
  lastActivityAt: Date
  averageResponseTime: number | null
}

/**
 * Generic success response
 */
export class SuccessResponseDto {
  success: boolean
  message?: string
}

/**
 * Generic error response
 */
export class ErrorResponseDto {
  success: false
  error: string
  message: string
  statusCode: number
}
