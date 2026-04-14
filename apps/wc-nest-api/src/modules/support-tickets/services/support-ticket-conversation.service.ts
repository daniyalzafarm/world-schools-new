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
  SupportTicketStatus,
} from '../../../generated/client/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { MessagesService } from '../../messaging/services/messages.service'
import { RedisPubSubService } from '../../messaging/services/redis-pub-sub.service'
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
    private readonly messagesService: MessagesService,
    private readonly redisPubSub: RedisPubSubService
  ) {}

  /**
   * Creates a backing conversation for a support ticket inside an existing transaction.
   * contextId is left null and must be set by the caller after the ticket is created.
   */
  async createConversationForTicketTx(
    tx: Prisma.TransactionClient,
    ticketData: CreateConversationTicketData,
    initialMessageContent: string,
    initialAttachmentIds?: string[]
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
      },
    })

    const senderId = requesterUserId ?? ticketData.createdByUserId
    const senderType =
      ticketData.requesterType === SupportTicketRequesterType.PROVIDER
        ? SenderType.PROVIDER
        : SenderType.USER

    const message = await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        senderType,
        content: initialMessageContent,
        contentType: ContentType.TEXT,
        status: MessageStatus.SENT,
        sentAt: new Date(),
      },
    })

    if (initialAttachmentIds && initialAttachmentIds.length > 0) {
      await tx.messageAttachment.updateMany({
        where: {
          id: { in: initialAttachmentIds },
          uploadedBy: senderId,
          messageId: null,
        },
        data: {
          messageId: message.id,
        },
      })
    }

    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageId: message.id,
        updatedAt: new Date(),
        lastActivityAt: new Date(),
        messageCount: 1,
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
    const result = await this.messagesService.getMessages({
      conversationId: ticket.conversationId,
      limit,
      cursor: cursor ?? undefined,
      direction: 'before',
    })
    const data = result.data as SupportTicketMessageResponse[]
    return {
      data,
      meta: { limit, nextCursor: result.nextCursor, hasMore: result.hasMore },
    }
  }

  private mapMessageToResponse(m: {
    id: string
    conversationId: string
    senderId: string
    senderType: SenderType
    content: string
    contentType: ContentType
    attachments?: unknown
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
      attachments: m.attachments ?? null,
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
        status: true,
        firstRespondedAt: true,
        assignedToUserId: true,
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

    const isRequesterReply = !!(ticket.requesterUserId && dto.senderId === ticket.requesterUserId)

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: isRequesterReply
        ? { lastRequesterReplyAt: new Date() }
        : { lastSupportReplyAt: new Date() },
    })

    await this._autoTransitionStatusAfterReply(ticket, isRequesterReply, dto.senderId)

    // sendMessage already returns message with sender and resolved attachments
    return message as unknown as SupportTicketMessageResponse
  }

  /**
   * Automatically transitions ticket status after a reply:
   * - Support replies to OPEN/IN_PROGRESS/PENDING_SUPPORT → PENDING_REQUESTER
   *   (also sets firstRespondedAt if this is the first support reply)
   * - Requester replies to PENDING_REQUESTER → PENDING_SUPPORT
   */
  private async _autoTransitionStatusAfterReply(
    ticket: {
      id: string
      status: SupportTicketStatus
      firstRespondedAt: Date | null
      requesterUserId: string | null
      assignedToUserId: string | null
    },
    isRequesterReply: boolean,
    replierUserId: string
  ): Promise<void> {
    const SUPPORT_REPLY_TRIGGER_STATUSES: SupportTicketStatus[] = [
      SupportTicketStatus.OPEN,
      SupportTicketStatus.IN_PROGRESS,
      SupportTicketStatus.PENDING_SUPPORT,
    ]

    let newStatus: SupportTicketStatus | null = null
    const extraData: Partial<{ firstRespondedAt: Date }> = {}

    if (!isRequesterReply && SUPPORT_REPLY_TRIGGER_STATUSES.includes(ticket.status)) {
      newStatus = SupportTicketStatus.PENDING_REQUESTER
      if (ticket.firstRespondedAt === null) {
        extraData.firstRespondedAt = new Date()
      }
    } else if (isRequesterReply && ticket.status === SupportTicketStatus.PENDING_REQUESTER) {
      newStatus = SupportTicketStatus.PENDING_SUPPORT
    }

    if (!newStatus) return

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: newStatus,
        ...extraData,
        statusHistory: {
          create: {
            fromStatus: ticket.status,
            toStatus: newStatus,
            changedByUserId: replierUserId,
            changeReason: isRequesterReply ? 'Requester replied' : 'Support replied',
          },
        },
      },
      select: { updatedAt: true },
    })

    void this.redisPubSub
      .publishMessage('ticket:statusUpdated', {
        ticketId: ticket.id,
        status: newStatus,
        resolvedAt: null,
        closedAt: null,
        updatedAt: updated.updatedAt,
        changedByUserId: replierUserId,
        requesterUserId: ticket.requesterUserId,
        assignedToUserId: ticket.assignedToUserId,
      })
      .catch(err => {
        this.logger.error('Failed to publish auto ticket status transition event', err)
      })
  }
}
