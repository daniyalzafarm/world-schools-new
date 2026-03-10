import type { ContextType, ConversationStatus } from '../../../generated/client/client'

export interface CreateConversationDto {
  userId: string
  participantId: string
  participantType: 'provider' | 'superadmin'
  contextType?: ContextType
  contextId?: string
  initialMessage?: string
}

export interface GetConversationsDto {
  userId?: string // Optional - set from authenticated user in controller
  filter?: 'all' | 'unread' | 'archived' | 'starred' | 'pinned'
  status?: any
  type?: any
  limit?: number
  offset?: number
  /**
   * When true, exclude conversations that are backed by a support ticket
   * (i.e. conversations where contextType === SUPPORT_TICKET).
   *
   * This is intended to be set by app-specific controllers (e.g. user/provider)
   * and should not be exposed as a public query parameter.
   */
  excludeSupportTicketContext?: boolean
}

export interface UpdateConversationSettingsDto {
  conversationId: string
  userId: string
  pinned?: boolean
  starred?: boolean
  muted?: boolean
  archived?: boolean
}

export interface AssignConversationDto {
  conversationId: string
  assignedToId: string
  assignedBy: string
}

export interface UpdateConversationStatusDto {
  conversationId: string
  status: ConversationStatus
  userId: string
}

export interface AddLabelDto {
  conversationId: string
  labelId: string
}

export interface RemoveLabelDto {
  conversationId: string
  labelId: string
}

export interface ConversationMetrics {
  totalMessages: number
  unreadMessages: number
  lastActivityAt: Date
  averageResponseTime?: number
}
