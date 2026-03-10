import type {
  SupportTicketAudience,
  SupportTicketPriority,
  SupportTicketResolutionCode,
  SupportTicketStatus,
} from '../../../generated/client/client'

export class SupportTicketCategoryResponseDto {
  id!: string
  key!: string
  name!: string
  description?: string | null
  audience!: SupportTicketAudience
}

export class SupportTicketRequesterUserDto {
  id!: string
  firstName!: string | null
  lastName!: string | null
  email!: string
}

export class SupportTicketRequesterProviderDto {
  id!: string
  legalCompanyName!: string | null
  email!: string | null
}

export class SupportTicketAssigneeDto {
  id!: string
  firstName!: string | null
  lastName!: string | null
  email!: string
}

export class SupportTicketLastMessageSenderDto {
  id!: string
  firstName!: string | null
  lastName!: string | null
}

export class SupportTicketLastMessageDto {
  id!: string
  content!: string
  senderId!: string
  senderType!: string
  sentAt!: Date
  sender?: SupportTicketLastMessageSenderDto | null
}

export class SupportTicketResponseDto {
  id!: string
  ticketNumber!: string
  subject!: string
  description?: string | null
  lastMessage?: SupportTicketLastMessageDto | null

  requesterType!: string
  requesterUser?: SupportTicketRequesterUserDto | null
  requesterProvider?: SupportTicketRequesterProviderDto | null

  sourceApp!: string
  category?: SupportTicketCategoryResponseDto | null
  priority!: SupportTicketPriority
  status!: SupportTicketStatus
  tags!: string[]

  conversationId!: string

  assignedToUser?: SupportTicketAssigneeDto | null
  assignedAt?: Date | null

  slaPolicyId?: string | null
  firstResponseDueAt?: Date | null
  firstRespondedAt?: Date | null
  resolutionDueAt?: Date | null
  resolvedAt?: Date | null
  closedAt?: Date | null
  slaFirstResponseBreachedAt?: Date | null
  slaResolutionBreachedAt?: Date | null

  resolvedByUserId?: string | null
  resolutionCode?: SupportTicketResolutionCode | null
  resolutionSummary?: string | null
  closedByUserId?: string | null
  closureReason?: string | null
  reopenedCount!: number
  lastReopenedAt?: Date | null
  lastReopenedByUserId?: string | null

  lastRequesterReplyAt?: Date | null
  lastSupportReplyAt?: Date | null

  bookingId?: string | null
  campId?: string | null
  sessionId?: string | null

  satisfactionScore?: number | null
  satisfactionSubmittedAt?: Date | null

  createdAt!: Date
  updatedAt!: Date
}

export class PaginatedSupportTicketsResponseDto {
  data!: SupportTicketResponseDto[]
  total!: number
  limit!: number
  offset!: number
  hasMore!: boolean
}
