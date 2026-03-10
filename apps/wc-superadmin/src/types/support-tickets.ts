/**
 * Support ticket types for WC Superadmin (mirror backend DTOs).
 */

export const SUPPORT_TICKET_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_REQUESTER: 'PENDING_REQUESTER',
  PENDING_SUPPORT: 'PENDING_SUPPORT',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUS)[keyof typeof SUPPORT_TICKET_STATUS]

export const SUPPORT_TICKET_PRIORITY = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const
export type SupportTicketPriority =
  (typeof SUPPORT_TICKET_PRIORITY)[keyof typeof SUPPORT_TICKET_PRIORITY]

export const SUPPORT_TICKET_SOURCE_APP = {
  WC_BOOKING: 'WC_BOOKING',
  WC_PROVIDER: 'WC_PROVIDER',
} as const
export type SupportTicketSourceApp =
  (typeof SUPPORT_TICKET_SOURCE_APP)[keyof typeof SUPPORT_TICKET_SOURCE_APP]

export const SUPPORT_TICKET_REQUESTER_TYPE = {
  PARENT: 'PARENT',
  PROVIDER: 'PROVIDER',
} as const
export type SupportTicketRequesterType =
  (typeof SUPPORT_TICKET_REQUESTER_TYPE)[keyof typeof SUPPORT_TICKET_REQUESTER_TYPE]

export interface SupportTicketCategory {
  id: string
  key: string
  name: string
  description?: string | null
  audience: string
}

export interface SupportTicketRequesterUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}

export interface SupportTicketRequesterProvider {
  id: string
  legalCompanyName: string | null
  email: string | null
}

export interface SupportTicketAssignee {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}

export interface SupportTicketLastMessageSender {
  id: string
  firstName: string | null
  lastName: string | null
}

export interface SupportTicketLastMessage {
  id: string
  content: string
  senderId: string
  senderType: string
  sentAt: string
  sender?: SupportTicketLastMessageSender | null
}

export interface SupportTicket {
  id: string
  ticketNumber: string
  subject: string
  description?: string | null
  lastMessage?: SupportTicketLastMessage | null
  requesterType: SupportTicketRequesterType
  requesterUser?: SupportTicketRequesterUser | null
  requesterProvider?: SupportTicketRequesterProvider | null
  sourceApp: SupportTicketSourceApp
  category?: SupportTicketCategory | null
  priority: SupportTicketPriority
  status: SupportTicketStatus
  tags: string[]
  conversationId: string
  assignedToUser?: SupportTicketAssignee | null
  assignedAt?: string | null
  slaPolicyId?: string | null
  firstResponseDueAt?: string | null
  firstRespondedAt?: string | null
  resolutionDueAt?: string | null
  resolvedAt?: string | null
  closedAt?: string | null
  slaFirstResponseBreachedAt?: string | null
  slaResolutionBreachedAt?: string | null
  resolvedByUserId?: string | null
  resolutionCode?: string | null
  resolutionSummary?: string | null
  closedByUserId?: string | null
  closureReason?: string | null
  reopenedCount: number
  lastReopenedAt?: string | null
  lastReopenedByUserId?: string | null
  lastRequesterReplyAt?: string | null
  lastSupportReplyAt?: string | null
  bookingId?: string | null
  campId?: string | null
  sessionId?: string | null
  satisfactionScore?: number | null
  satisfactionSubmittedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface PaginatedSupportTicketsMeta {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface PaginatedSupportTickets {
  data: SupportTicket[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface ListTicketsParams {
  status?: string
  priority?: string
  categoryKey?: string
  requesterType?: string
  searchTerm?: string
  limit?: number
  offset?: number
}

export interface SupportTicketStats {
  open: number
  inProgress: number
  pending: number
  resolved: number
  closed: number
  total: number
}

/** Message shape from GET conversation (same as messaging module for DRY). */
export interface SupportTicketMessageResponse {
  id: string
  conversationId: string
  senderId: string
  senderType: string
  content: string
  contentType?: string
  attachments?: unknown
  type?: string
  metadata?: unknown
  replyToId?: string | null
  forwardedFromId?: string | null
  forwardCount?: number
  isPinned?: boolean
  pinnedAt?: string | null
  pinnedBy?: string | null
  priority?: string | null
  scheduledFor?: string | null
  scheduledBy?: string | null
  isScheduled?: boolean
  status?: string
  deliveredAt?: string | null
  readAt?: string | null
  sentAt: string
  deliveryLatencyMs?: number | null
  editedAt?: string | null
  deletedAt?: string | null
  deletedBy?: string | null
  isDeleted?: boolean
  deletionType?: string | null
  createdAt: string
  updatedAt: string
  sender?: { id: string; firstName: string | null; lastName: string | null; email: string }
}

export interface ConversationResponseMeta {
  limit: number
  nextCursor?: string | null
  hasMore: boolean
}
