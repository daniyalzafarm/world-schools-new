/**
 * Messaging System Model Types
 *
 * TypeScript interfaces matching the backend Prisma models.
 * These types represent the database schema for the messaging system.
 *
 * @module messaging/types/models
 */

import type {
  ConversationType,
  ConversationStatus,
  ContextType,
  SenderType,
  ContentType,
  MessageType,
  MessageStatus,
  MessagePriority,
  DeletionType,
  FileType,
  PresenceStatus,
  ReportReason,
  ReportStatus,
} from './enums'

/**
 * Conversation model
 * Represents a conversation between participants
 */
export interface Conversation {
  id: string
  type: ConversationType
  subject: string | null
  contextType: ContextType | null
  contextId: string | null
  metadata: Record<string, any> | null

  // Assignment fields (for provider conversations)
  assignedToUserId: string | null
  assignedAt: Date | null
  assignedBy: string | null

  // Status tracking
  status: ConversationStatus
  openedAt: Date
  statusChangedAt: Date | null
  statusChangedByUser: string | null

  // Metrics
  messageCount: number
  participantCount: number
  avgResponseTime: number | null
  lastActivityAt: Date

  // Timestamps
  createdAt: Date
  updatedAt: Date

  // Relations
  lastMessageId: string | null
  lastMessage?: Message
  participants?: ConversationParticipant[]
  messages?: Message[]
  labels?: ConversationLabelAssignment[]
}

/**
 * Conversation participant model
 * Represents a user's participation in a conversation
 */
export interface ConversationParticipant {
  id: string
  conversationId: string
  userId: string
  providerId: string | null

  // User preferences
  pinned: boolean
  starred: boolean
  muted: boolean
  archived: boolean

  // Read tracking
  unreadCount: number
  lastReadAt: Date | null
  lastReadMessageId: string | null

  // Typing indicator
  isTyping: boolean
  lastTypingAt: Date | null

  // Rate limiting
  isRateLimited: boolean
  rateLimitUntil: Date | null

  // Timestamps
  joinedAt: Date
  leftAt: Date | null

  // Relations
  conversation?: Conversation
  user?: any // User model from main schema
  provider?: any // Provider model from main schema
}

/**
 * Message model
 * Represents a message in a conversation
 */
export interface Message {
  id: string
  conversationId: string
  senderId: string
  senderType: SenderType

  // Content
  content: string
  contentType: ContentType
  attachments: Record<string, any> | null
  type: MessageType
  metadata: Record<string, any> | null

  // Threading
  replyToId: string | null
  forwardedFromId: string | null
  forwardCount: number

  // Pinning
  isPinned: boolean
  pinnedAt: Date | null
  pinnedBy: string | null

  // Scheduling
  priority: MessagePriority | null
  scheduledFor: Date | null
  scheduledBy: string | null
  isScheduled: boolean

  // Status
  status: MessageStatus
  deliveredAt: Date | null
  readAt: Date | null
  sentAt: Date
  deliveryLatencyMs: number | null

  // Editing
  editedAt: Date | null

  // Deletion
  deletedAt: Date | null
  deletedBy: string | null
  isDeleted: boolean
  deletionType: DeletionType | null

  // Full-text search
  searchVector: string | null

  // Timestamps
  createdAt: Date
  updatedAt: Date

  // Relations
  conversation?: Conversation
  sender?: any // User model
  replyTo?: Message
  forwardedFrom?: Message
  readReceipts?: MessageReadReceipt[]
  deliveryReceipts?: MessageDeliveryReceipt[]
  reactions?: MessageReaction[]
  editHistory?: MessageEditHistory[]
  mentions?: MessageMention[]
  bookmarks?: MessageBookmark[]
  reports?: MessageReport[]
  attachmentRecords?: MessageAttachment[]
}

/**
 * Message read receipt model
 * Tracks when a message was read by a user
 */
export interface MessageReadReceipt {
  id: string
  messageId: string
  userId: string
  readAt: Date

  // Relations
  message?: Message
  user?: any // User model
}

/**
 * Message delivery receipt model
 * Tracks when a message was delivered to a user
 */
export interface MessageDeliveryReceipt {
  id: string
  messageId: string
  userId: string
  deliveredAt: Date

  // Relations
  message?: Message
  user?: any // User model
}

/**
 * Message reaction model
 * Represents an emoji reaction to a message
 */
export interface MessageReaction {
  id: string
  messageId: string
  userId: string
  emoji: string
  createdAt: Date

  // Relations
  message?: Message
  user?: any // User model
}

/**
 * Message edit history model
 * Tracks the edit history of a message
 */
export interface MessageEditHistory {
  id: string
  messageId: string
  previousContent: string
  editedBy: string
  editedAt: Date
  editReason: string | null

  // Relations
  message?: Message
  editor?: any // User model
}

/**
 * Message mention model
 * Represents a user mention in a message
 */
export interface MessageMention {
  id: string
  messageId: string
  userId: string
  position: number | null
  createdAt: Date

  // Relations
  message?: Message
  user?: any // User model
}

/**
 * Message bookmark model
 * Represents a user's bookmark of a message
 */
export interface MessageBookmark {
  id: string
  messageId: string
  userId: string
  note: string | null
  createdAt: Date

  // Relations
  message?: Message
  user?: any // User model
}

/**
 * Message report model
 * Represents a report of inappropriate message content
 */
export interface MessageReport {
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

  // Relations
  message?: Message
  reporter?: any // User model
  reviewer?: any // User model
}

/**
 * Message attachment model
 * Represents a file attachment to a message
 */
export interface MessageAttachment {
  id: string
  messageId: string

  // File metadata
  fileName: string
  fileSize: number
  mimeType: string
  fileType: FileType

  // Storage
  storageUrl: string
  thumbnailUrl: string | null

  // Image/video metadata
  width: number | null
  height: number | null
  duration: number | null

  // Upload tracking
  uploadedAt: Date
  uploadedBy: string

  // Relations
  message?: Message
  uploader?: any // User model
}

/**
 * User presence model
 * Tracks user online/offline status
 */
export interface UserPresence {
  userId: string
  status: PresenceStatus
  lastSeenAt: Date
  updatedAt: Date

  // Relations
  user?: any // User model
}

/**
 * Conversation label model
 * Represents a label that can be applied to conversations
 */
export interface ConversationLabel {
  id: string
  name: string
  color: string | null
  icon: string | null
  createdBy: string
  createdAt: Date

  // Relations
  creator?: any // User model
  assignments?: ConversationLabelAssignment[]
}

/**
 * Conversation label assignment model
 * Represents the assignment of a label to a conversation
 */
export interface ConversationLabelAssignment {
  conversationId: string
  labelId: string
  assignedBy: string
  assignedAt: Date

  // Relations
  conversation?: Conversation
  label?: ConversationLabel
  assigner?: any // User model
}
