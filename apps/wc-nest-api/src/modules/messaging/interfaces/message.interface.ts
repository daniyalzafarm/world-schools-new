import type {
  ContentType,
  DeletionType,
  MessagePriority,
  ReportReason,
} from '../../../generated/client/client'

export interface SendMessageDto {
  conversationId: string
  senderId: string
  senderType: 'USER' | 'PROVIDER' | 'SUPERADMIN' | 'CHATBOT' | 'SYSTEM'
  content: string
  contentType?: ContentType
  attachmentIds?: string[]
  replyToId?: string
  priority?: MessagePriority
  scheduledFor?: Date
  idempotencyKey: string
  /** Client-generated temp ID for optimistic update correlation */
  tempId?: string
}

export interface GetMessagesDto {
  conversationId: string
  limit?: number
  cursor?: string
  direction?: 'before' | 'after'
}

export interface EditMessageDto {
  messageId: string
  userId: string
  newContent: string
  editReason?: string
}

export interface DeleteMessageDto {
  messageId: string
  userId: string
  deletionType?: DeletionType
}

export interface MarkAsReadDto {
  messageId: string
  userId: string
}

export interface MarkAsDeliveredDto {
  messageId: string
  userId: string
  deliveryLatencyMs?: number // Optional: client-measured delivery latency
}

export interface AddReactionDto {
  messageId: string
  userId: string
  emoji: string
}

export interface RemoveReactionDto {
  messageId: string
  userId: string
  emoji: string
}

export interface BookmarkMessageDto {
  messageId: string
  userId: string
  note?: string // Optional note field
}

export interface UnbookmarkMessageDto {
  messageId: string
  userId: string
}

export interface PinMessageDto {
  messageId: string
  userId: string
}

export interface UnpinMessageDto {
  messageId: string
}

export interface ForwardMessageDto {
  messageId: string
  toConversationId: string
  forwardedBy: string
}

export interface ScheduleMessageDto {
  conversationId: string
  senderId: string
  content: string
  scheduledFor: Date
  scheduledBy: string
}

export interface ReportMessageDto {
  messageId: string
  reportedBy: string
  reason: ReportReason
  description?: string
}

export interface SearchMessagesDto {
  userId: string
  query: string
  conversationId?: string
  limit?: number
  offset?: number
  // Enhanced search filters
  contentType?: string // Filter by content type (TEXT, IMAGE, FILE, etc.)
  senderId?: string // Filter by sender
  startDate?: Date // Filter by date range start
  endDate?: Date // Filter by date range end
}
