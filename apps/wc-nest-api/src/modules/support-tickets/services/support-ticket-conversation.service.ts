import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import {
  ContentType,
  ContextType,
  ConversationType,
  DeletionType,
  MessagePriority,
  MessageStatus,
  MessageType,
  Prisma,
  SenderType,
  SupportTicketRequesterType,
} from '../../../generated/client/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { MessagesService } from '../../messaging/services/messages.service'
import { CreateTicketReplyDto } from '../dto'

/** Shape aligned with messaging module MessageResponseDto for frontend DRY. */
export interface SupportTicketMessageResponse {
  id: string
  conversationId: string
  senderId: string
  senderType: SenderType
  content: string
  contentType: ContentType
  attachments: unknown
  type: MessageType
  metadata: unknown
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
  sender?: { id: string; firstName: string | null; lastName: string | null; email: string }
}

export type CreateConversationTicketData = {
  subject: string
  requesterType: SupportTicketRequesterType
  requesterUserId: string | null
  requesterProviderId: string | null
  createdByUserId: string
}

@Injectable()
export class SupportTicketConversationService {
  private readonly logger = new Logger(SupportTicketConversationService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService
  ) {}

  /**
   * Creates a backing conversation for a support ticket inside an existing transaction.
   * contextId is left null and must be set by the caller after the ticket is created.
   */
  async createConversationForTicketTx(
    tx: Prisma.TransactionClient,
    ticketData: CreateConversationTicketData,
    initialMessageContent: string
  ): Promise<string> {
    const requesterUserId = ticketData.requesterUserId
    const requesterProviderId = ticketData.requesterProviderId

    const type =
      ticketData.requesterType === SupportTicketRequesterType.PROVIDER
        ? ConversationType.PROVIDER_SUPERADMIN
        : ConversationType.USER_SUPERADMIN

    const conversation = await tx.conversation.create({
      data: {
        type,
        subject: ticketData.subject,
        contextType: ContextType.SUPPORT_TICKET,
        contextId: null,
        metadata:
          requesterProviderId != null
            ? {
                providerId: requesterProviderId,
              }
            : undefined,
        participants: requesterUserId
          ? {
              create: [
                {
                  userId: requesterUserId,
                },
              ],
            }
          : undefined,
        messages: {
          create: {
            senderId: requesterUserId ?? ticketData.createdByUserId,
            senderType:
              ticketData.requesterType === SupportTicketRequesterType.PROVIDER
                ? SenderType.PROVIDER
                : SenderType.USER,
            content: initialMessageContent,
          },
        },
      },
    })

    return conversation.id
  }

  async getTicketConversationMessages(
    ticketId: string,
    options: { limit?: number; cursor?: string }
  ): Promise<{
    data: SupportTicketMessageResponse[]
    meta: { limit: number; nextCursor: string | null; hasMore: boolean }
  }> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { conversationId: true },
    })

    if (!ticket?.conversationId) {
      throw new NotFoundException('Support ticket conversation not found')
    }

    const { limit = 50, cursor } = options
    const take = limit + 1

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: ticket.conversationId,
        isDeleted: false,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })

    const hasMore = messages.length > limit
    const data = (hasMore ? messages.slice(0, limit) : messages).map(m =>
      this.mapMessageToResponse(m)
    )
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : null

    return {
      data,
      meta: { limit, nextCursor, hasMore },
    }
  }

  private mapMessageToResponse(m: {
    id: string
    conversationId: string
    senderId: string
    senderType: SenderType
    content: string
    contentType: ContentType
    attachments: unknown
    type: MessageType
    metadata: unknown
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
    sender?: { id: string; firstName: string | null; lastName: string | null; email: string }
  }): SupportTicketMessageResponse {
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderType: m.senderType,
      content: m.content,
      contentType: m.contentType,
      attachments: m.attachments,
      type: m.type,
      metadata: m.metadata,
      replyToId: m.replyToId,
      forwardedFromId: m.forwardedFromId,
      forwardCount: m.forwardCount,
      isPinned: m.isPinned,
      pinnedAt: m.pinnedAt,
      pinnedBy: m.pinnedBy,
      priority: m.priority,
      scheduledFor: m.scheduledFor,
      scheduledBy: m.scheduledBy,
      isScheduled: m.isScheduled,
      status: m.status,
      deliveredAt: m.deliveredAt,
      readAt: m.readAt,
      sentAt: m.sentAt,
      deliveryLatencyMs: m.deliveryLatencyMs,
      editedAt: m.editedAt,
      deletedAt: m.deletedAt,
      deletedBy: m.deletedBy,
      isDeleted: m.isDeleted,
      deletionType: m.deletionType,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      sender: m.sender ?? undefined,
    }
  }

  async addReply(
    ticketId: string,
    dto: CreateTicketReplyDto,
    currentUserId: string
  ): Promise<SupportTicketMessageResponse> {
    this.logger.log(`Adding reply to ticket ${ticketId} by user ${currentUserId}`)

    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        conversationId: true,
        requesterUserId: true,
        requesterType: true,
      },
    })

    if (!ticket?.conversationId) {
      throw new NotFoundException('Support ticket conversation not found')
    }

    const message = await this.messagesService.sendMessage({
      conversationId: ticket.conversationId,
      senderId: dto.senderId,
      senderType: dto.senderType,
      content: dto.content,
      contentType: dto.contentType,
      attachmentIds: dto.attachmentIds,
      // Ensure idempotent sends for ticket replies
      idempotencyKey: `support-ticket-reply:${ticketId}:${dto.senderId}:${Date.now()}`,
    })

    const isRequesterReply = ticket.requesterUserId && dto.senderId === ticket.requesterUserId

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: isRequesterReply
        ? { lastRequesterReplyAt: new Date() }
        : { lastSupportReplyAt: new Date() },
    })

    const withSender = await this.prisma.message.findUnique({
      where: { id: message.id },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    })
    if (!withSender) throw new NotFoundException('Message not found after create')
    return this.mapMessageToResponse(withSender)
  }
}
