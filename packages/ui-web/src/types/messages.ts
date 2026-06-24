/**
 * Shared types for lightweight messaging UI components.
 *
 * These are intentionally minimal and are populated from the richer
 * messaging DTOs exposed via @world-schools/wc-frontend-utils.
 */

export interface MessageAttachment {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  fileType: 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'AUDIO' | 'OTHER'
  url: string
  thumbnailUrl?: string | null
}

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

  // Optional attachments rendered beneath the message bubble
  attachments?: MessageAttachment[] | null
}

export interface Conversation {
  id: string
  name: string
  lastMessage: string
  /**
   * Optional camp this conversation is about. When set, it's shown as the item
   * subtitle ("Asks about: <contextLabel>") in place of the last-message/active
   * line — used on the provider side, where threads are camp-specific.
   */
  contextLabel?: string
  time: number // Timestamp of last message
  lastSeen: number // Timestamp when user was last active
  avatar: string // Image path for web
  verified?: boolean
  starred?: boolean
  pinned?: boolean
  /**
   * Whether the current user can change per-conversation settings (pin/star/
   * mute/archive). False for provider-org viewers who have no participant row
   * yet (haven't replied) — the backend rejects those toggles, so the UI
   * disables them. Undefined is treated as allowed.
   */
  canManageSettings?: boolean
  archived?: boolean
  muted?: boolean
  unread?: boolean
  unreadCount?: number // Number of unread messages
  /**
   * Backend conversation context ('BOOKING' | 'CAMP' | 'PROVIDER' | 'GENERAL').
   * Typed as string so ui-web stays free of a wc-frontend-utils dependency.
   * Used by the provider sidebar to split the Inquiries vs Bookings tabs.
   */
  contextType?: string
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
