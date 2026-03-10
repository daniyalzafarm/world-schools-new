/**
 * Shared types for messaging functionality across all applications
 */

export interface Message {
  id: string
  text: string
  isUser: boolean
  timestamp?: Date
  isStreaming?: boolean
  isTransferRequest?: boolean
  isTransferSummary?: boolean
  isChatbot?: boolean
  isAdmin?: boolean

  // Optional delivery/read indicators (used by support tickets and messaging UIs)
  status?: string
  deliveredAt?: Date | null
  readAt?: Date | null
}

export interface Conversation {
  id: string
  name: string
  lastMessage: string
  time: number // Timestamp of last message
  lastSeen: number // Timestamp when user was last active
  avatar: string // Image path for web
  verified?: boolean
  starred?: boolean
  pinned?: boolean
  pinnedAt?: number // Timestamp when pinned
  archived?: boolean
  muted?: boolean
  unread?: boolean
  blocked?: boolean
  unreadCount?: number // Number of unread messages
  userProfileData?: any // Detailed user profile for the participant
}

export type FilterType = 'all' | 'favorites' | 'unread'

export interface ReportReason {
  id: string
  label: string
}

export const DEFAULT_REPORT_REASONS: ReportReason[] = [
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'spam', label: 'Spam or unwanted messages' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'scam', label: 'Scam or fraud' },
  { id: 'other', label: 'Other' },
]
