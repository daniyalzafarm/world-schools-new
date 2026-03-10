/**
 * Support ticket types for wc-booking, mirroring backend DTOs.
 */

export type SupportTicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'PENDING_REQUESTER'
  | 'PENDING_SUPPORT'
  | 'RESOLVED'
  | 'CLOSED'

export type SupportTicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export type SupportTicketSourceApp = 'WC_BOOKING' | 'WC_PROVIDER' | 'WC_SUPERADMIN' | 'API'

export type SupportTicketRequesterType = 'PARENT' | 'PROVIDER'

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

  firstResponseDueAt?: string | null
  firstRespondedAt?: string | null
  resolutionDueAt?: string | null
  resolvedAt?: string | null
  closedAt?: string | null

  lastRequesterReplyAt?: string | null
  lastSupportReplyAt?: string | null

  bookingId?: string | null
  campId?: string | null
  sessionId?: string | null

  createdAt: string
  updatedAt: string
}

export interface PaginatedSupportTickets {
  data: SupportTicket[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

/** Message shape from GET /user/support-tickets/:id/conversation (mirrors superadmin version). */
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

/** Create ticket payload sent to POST /support-tickets */
export interface CreateSupportTicketPayload {
  requesterType: SupportTicketRequesterType
  requesterUserId?: string
  requesterProviderId?: string
  sourceApp: SupportTicketSourceApp
  categoryKey: string
  priority?: SupportTicketPriority
  subject: string
  description: string
  bookingId?: string
  campId?: string
  sessionId?: string
}

/** List tickets query params for GET /support-tickets */
export interface ListSupportTicketsParams {
  status?: SupportTicketStatus
  priority?: SupportTicketPriority
  requesterType?: SupportTicketRequesterType
  requesterUserId?: string
  requesterProviderId?: string
  categoryKey?: string
  sourceApp?: SupportTicketSourceApp
  searchTerm?: string
  limit?: number
  offset?: number
}

// --- Status/priority display helpers ---

export const SUPPORT_TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  PENDING_REQUESTER: 'Pending your reply',
  PENDING_SUPPORT: 'Pending support',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

export const SUPPORT_TICKET_PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
}
