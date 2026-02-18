/**
 * Messaging System Enums
 *
 * TypeScript enums matching the backend Prisma schema enums.
 * These enums are used throughout the messaging system for type safety.
 *
 * @module messaging/types/enums
 */

/**
 * Type of conversation between participants
 */
export enum ConversationType {
  /** Parent/User ↔ Camp Provider */
  USER_PROVIDER = 'USER_PROVIDER',
  /** Parent/User ↔ Platform Support */
  USER_SUPERADMIN = 'USER_SUPERADMIN',
  /** Provider ↔ Platform Support (future) */
  PROVIDER_SUPERADMIN = 'PROVIDER_SUPERADMIN',
}

/**
 * Type of message sender
 */
export enum SenderType {
  USER = 'USER',
  PROVIDER = 'PROVIDER',
  SUPERADMIN = 'SUPERADMIN',
  CHATBOT = 'CHATBOT',
  SYSTEM = 'SYSTEM',
}

/**
 * Type of message content
 */
export enum ContentType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
}

/**
 * Type of message
 */
export enum MessageType {
  REGULAR = 'REGULAR',
  TRANSFER_REQUEST = 'TRANSFER_REQUEST',
  TRANSFER_SUMMARY = 'TRANSFER_SUMMARY',
  SYSTEM_NOTIFICATION = 'SYSTEM_NOTIFICATION',
  CHATBOT_RESPONSE = 'CHATBOT_RESPONSE',
}

/**
 * Status of message delivery
 */
export enum MessageStatus {
  SENDING = 'SENDING',
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

/**
 * Type of file attachment
 */
export enum FileType {
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  OTHER = 'OTHER',
}

/**
 * User presence status
 */
export enum PresenceStatus {
  ONLINE = 'ONLINE',
  AWAY = 'AWAY',
  OFFLINE = 'OFFLINE',
}

/**
 * Context type for conversation
 */
export enum ContextType {
  BOOKING = 'BOOKING',
  CAMP = 'CAMP',
  PROVIDER = 'PROVIDER',
  GENERAL = 'GENERAL',
}

/**
 * Type of message deletion
 */
export enum DeletionType {
  /** User deleted their own message */
  USER_DELETED = 'USER_DELETED',
  /** Admin/moderator deleted */
  ADMIN_DELETED = 'ADMIN_DELETED',
  /** Auto-deleted (retention policy) */
  AUTO_DELETED = 'AUTO_DELETED',
  /** GDPR right to be forgotten */
  GDPR_DELETED = 'GDPR_DELETED',
}

/**
 * Message priority level
 */
export enum MessagePriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/**
 * Conversation status
 */
export enum ConversationStatus {
  /** Active conversation */
  OPEN = 'OPEN',
  /** Waiting for user response */
  PENDING = 'PENDING',
  /** Issue resolved, awaiting confirmation */
  RESOLVED = 'RESOLVED',
  /** Conversation closed */
  CLOSED = 'CLOSED',
  /** Archived for reference */
  ARCHIVED = 'ARCHIVED',
}

/**
 * Reason for reporting a message
 */
export enum ReportReason {
  SPAM = 'SPAM',
  HARASSMENT = 'HARASSMENT',
  INAPPROPRIATE_CONTENT = 'INAPPROPRIATE_CONTENT',
  SCAM = 'SCAM',
  IMPERSONATION = 'IMPERSONATION',
  OTHER = 'OTHER',
}

/**
 * Status of message report
 */
export enum ReportStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}
