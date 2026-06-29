import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { NotificationType } from '@world-schools/wc-types'
import { notify } from '../../notifications/dispatcher/notify'
import {
  Prisma,
  SupportTicketAudience,
  SupportTicketPriority,
  SupportTicketRequesterType,
  SupportTicketStatus,
} from '../../../generated/client/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { RedisPubSubService } from '../../messaging/services/redis-pub-sub.service'
import {
  AssignSupportTicketDto,
  CreateSupportTicketDto,
  GetSupportTicketsDto,
  ReopenSupportTicketDto,
  UpdateSupportTicketDto,
  UpdateSupportTicketStatusDto,
} from '../dto'
import { SupportTicketSlaService } from './support-ticket-sla.service'
import { SupportTicketConversationService } from './support-ticket-conversation.service'

@Injectable()
export class SupportTicketsService {
  private readonly logger = new Logger(SupportTicketsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly slaService: SupportTicketSlaService,
    private readonly conversationService: SupportTicketConversationService,
    private readonly redisPubSub: RedisPubSubService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async createTicket(
    dto: CreateSupportTicketDto,
    currentUserId: string,
    currentUserProviderId?: string | null
  ) {
    this.logger.log(`Creating support ticket for user ${currentUserId}`)

    if (dto.requesterType === SupportTicketRequesterType.PARENT && !dto.requesterUserId) {
      throw new BadRequestException('requesterUserId is required for PARENT tickets')
    }

    if (dto.requesterType === SupportTicketRequesterType.PROVIDER) {
      if (!dto.requesterUserId || !dto.requesterProviderId) {
        throw new BadRequestException(
          'requesterUserId and requesterProviderId are required for PROVIDER tickets'
        )
      }
    }

    // Self-service: requester must be the current user (and for PROVIDER, their provider)
    if (
      dto.requesterType === SupportTicketRequesterType.PARENT &&
      dto.requesterUserId !== currentUserId
    ) {
      throw new ForbiddenException('requesterUserId must match the current user for PARENT tickets')
    }
    if (dto.requesterType === SupportTicketRequesterType.PROVIDER) {
      if (dto.requesterUserId !== currentUserId) {
        throw new ForbiddenException(
          'requesterUserId must match the current user for PROVIDER tickets'
        )
      }
      if (currentUserProviderId != null && dto.requesterProviderId !== currentUserProviderId) {
        throw new ForbiddenException(
          'requesterProviderId must match your provider for PROVIDER tickets'
        )
      }
    }

    if (dto.requesterUserId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.requesterUserId },
        select: { id: true },
      })

      if (!user) {
        throw new NotFoundException('Requester user not found')
      }
    }

    if (dto.requesterProviderId) {
      const provider = await this.prisma.provider.findUnique({
        where: { id: dto.requesterProviderId },
        select: { id: true },
      })

      if (!provider) {
        throw new NotFoundException('Requester provider not found')
      }
    }

    const category = await this.prisma.supportTicketCategory.findUnique({
      where: { key: dto.categoryKey },
      include: {
        defaultSlaPolicy: true,
      },
    })

    if (!category) {
      throw new BadRequestException(`Support ticket category '${dto.categoryKey}' not found`)
    }

    const priority = dto.priority ?? category.defaultPriority ?? SupportTicketPriority.NORMAL

    const slaPolicyId = category.defaultSlaPolicyId ?? null

    const result = await this.prisma.$transaction(async tx => {
      const createdAt = new Date()

      const ticketNumber = await this.generateTicketNumber(tx, createdAt)

      const slaTargets = await this.slaService.getInitialTargets(tx, createdAt, slaPolicyId)

      const conversationId = await this.conversationService.createConversationForTicketTx(
        tx,
        {
          subject: dto.subject,
          requesterType: dto.requesterType,
          requesterUserId: dto.requesterUserId ?? null,
          requesterProviderId: dto.requesterProviderId ?? null,
          createdByUserId: currentUserId,
        },
        dto.description,
        dto.attachmentIds
      )

      const ticket = await tx.supportTicket.create({
        data: {
          ticketNumber,
          subject: dto.subject,
          description: dto.description,
          conversationId,
          requesterType: dto.requesterType,
          requesterUserId: dto.requesterUserId ?? null,
          requesterProviderId: dto.requesterProviderId ?? null,
          createdByUserId: currentUserId,
          sourceApp: dto.sourceApp,
          categoryId: category.id,
          priority,
          status: SupportTicketStatus.OPEN,
          bookingId: dto.bookingId ?? null,
          campId: dto.campId ?? null,
          sessionId: dto.sessionId ?? null,
          slaPolicyId,
          firstResponseDueAt: slaTargets.firstResponseDueAt,
          resolutionDueAt: slaTargets.resolutionDueAt,
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: SupportTicketStatus.OPEN,
              changedByUserId: currentUserId,
              changeReason: 'Ticket created',
            },
          },
        },
        include: {
          category: true,
          requesterUser: true,
          requesterProvider: true,
          assignedTo: true,
        },
      })

      await tx.conversation.update({
        where: { id: conversationId },
        data: { contextId: ticket.id },
      })

      return ticket
    })

    // Notify all superadmins of the new ticket so it can
    // be triaged. Single notify() outside the transaction matches the
    // dispatcher's eventually-consistent contract.
    notify(this.eventEmitter, NotificationType.SuperadminSupportTicketNew, {
      supportTicketId: result.id,
    })

    return this.mapTicketToResponse(result)
  }

  /**
   * Get a ticket by ID or ticket number.
   * When accessContext is provided and hasSupportTicketsRead is false, the user must be the requester, assignee, or (for providers) the ticket's requesterProviderId must match their providerId.
   */
  async getTicketById(
    id: string,
    accessContext?: {
      currentUserId: string
      providerId?: string | null
      hasSupportTicketsRead: boolean
    }
  ) {
    const where = id.startsWith('WC-') ? { ticketNumber: id } : { id }

    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        ...where,
        deletedAt: null,
      },
      include: {
        category: true,
        requesterUser: true,
        requesterProvider: true,
        assignedTo: true,
        conversation: {
          include: {
            lastMessage: {
              include: {
                sender: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
    })

    if (!ticket) {
      throw new NotFoundException('Support ticket not found')
    }

    if (accessContext && !accessContext.hasSupportTicketsRead) {
      const isRequester = ticket.requesterUserId === accessContext.currentUserId
      const isAssignee = ticket.assignedToUserId === accessContext.currentUserId
      const isProviderRequester =
        accessContext.providerId != null && ticket.requesterProviderId === accessContext.providerId
      if (!isRequester && !isAssignee && !isProviderRequester) {
        throw new ForbiddenException('You do not have access to this ticket')
      }
    }

    return this.mapTicketToResponse(ticket)
  }

  /**
   * List tickets for the current user (self-service): only tickets where they are the requester (by userId or providerId).
   * Used by Parent and Provider apps without requiring support_tickets.read permission.
   */
  async listMyTickets(
    currentUserId: string,
    providerId: string | null | undefined,
    query: GetSupportTicketsDto
  ) {
    this.logger.log(`Listing my support tickets for user ${currentUserId}`)

    const ownerCondition =
      providerId != null
        ? { OR: [{ requesterUserId: currentUserId }, { requesterProviderId: providerId }] }
        : { requesterUserId: currentUserId }

    const where: any = {
      deletedAt: null,
      ...ownerCondition,
    }

    if (query.status) where.status = query.status
    if (query.priority) where.priority = query.priority
    if (query.requesterType) where.requesterType = query.requesterType
    if (query.sourceApp) where.sourceApp = query.sourceApp
    if (query.categoryKey) {
      where.category = { key: query.categoryKey }
    }
    if (query.createdFrom || query.createdTo) {
      where.createdAt = {}
      if (query.createdFrom) where.createdAt.gte = query.createdFrom
      if (query.createdTo) where.createdAt.lte = query.createdTo
    }
    if (query.searchTerm) {
      const term = query.searchTerm
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { ticketNumber: { contains: term, mode: 'insensitive' } },
            { subject: { contains: term, mode: 'insensitive' } },
          ],
        },
      ]
    }

    const limit = query.limit ?? 50
    const offset = query.offset ?? 0

    const [tickets, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        include: {
          category: true,
          requesterUser: true,
          requesterProvider: true,
          assignedTo: true,
          conversation: {
            include: {
              lastMessage: {
                include: {
                  sender: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ])

    const data = tickets.map(t => this.mapTicketToResponse(t))
    const hasMore = offset + data.length < total

    return {
      data,
      meta: {
        total,
        limit,
        offset,
        hasMore,
      },
    }
  }

  async listTickets(query: GetSupportTicketsDto, currentUserId: string) {
    this.logger.log(`Listing support tickets for user ${currentUserId}`)

    const where: any = {
      deletedAt: null,
    }

    if (query.status) where.status = query.status
    if (query.priority) where.priority = query.priority
    if (query.assignedToUserId) where.assignedToUserId = query.assignedToUserId
    if (query.requesterType) where.requesterType = query.requesterType
    if (query.requesterUserId) where.requesterUserId = query.requesterUserId
    if (query.requesterProviderId) where.requesterProviderId = query.requesterProviderId
    if (query.sourceApp) where.sourceApp = query.sourceApp
    if (query.categoryKey) {
      where.category = { key: query.categoryKey }
    }
    if (query.createdFrom || query.createdTo) {
      where.createdAt = {}
      if (query.createdFrom) where.createdAt.gte = query.createdFrom
      if (query.createdTo) where.createdAt.lte = query.createdTo
    }
    if (query.searchTerm) {
      const term = query.searchTerm
      where.OR = [
        { ticketNumber: { contains: term, mode: 'insensitive' } },
        { subject: { contains: term, mode: 'insensitive' } },
      ]
    }

    const limit = query.limit ?? 50
    const offset = query.offset ?? 0

    const [tickets, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        include: {
          category: true,
          requesterUser: true,
          requesterProvider: true,
          assignedTo: true,
          conversation: {
            include: {
              lastMessage: {
                include: {
                  sender: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ])

    const data = tickets.map(t => this.mapTicketToResponse(t))
    const hasMore = offset + data.length < total

    return {
      data,
      meta: {
        total,
        limit,
        offset,
        hasMore,
      },
    }
  }

  /**
   * Get ticket counts by status for dashboard tabs and sidebar badge.
   */
  async getTicketCountsByStatus(): Promise<{
    open: number
    inProgress: number
    pending: number
    resolved: number
    closed: number
    total: number
  }> {
    const where = { deletedAt: null }
    const [grouped, total] = await Promise.all([
      this.prisma.supportTicket.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      this.prisma.supportTicket.count({ where }),
    ])
    const byStatus: Record<string, number> = {}
    for (const row of grouped) {
      byStatus[row.status] = row._count.id
    }
    const open = byStatus[SupportTicketStatus.OPEN] ?? 0
    const inProgress = byStatus[SupportTicketStatus.IN_PROGRESS] ?? 0
    const pending =
      (byStatus[SupportTicketStatus.PENDING_REQUESTER] ?? 0) +
      (byStatus[SupportTicketStatus.PENDING_SUPPORT] ?? 0)
    const resolved = byStatus[SupportTicketStatus.RESOLVED] ?? 0
    const closed = byStatus[SupportTicketStatus.CLOSED] ?? 0
    return { open, inProgress, pending, resolved, closed, total }
  }

  /**
   * List active support ticket categories for a given requester audience.
   * Used by GET /user/support-ticket-categories and GET /provider/support-ticket-categories.
   *
   * @param requesterType 'PARENT' or 'PROVIDER'
   */
  async listCategories(requesterType: 'PARENT' | 'PROVIDER') {
    const audience =
      requesterType === 'PARENT' ? SupportTicketAudience.PARENT : SupportTicketAudience.PROVIDER

    return this.prisma.supportTicketCategory.findMany({
      where: {
        isActive: true,
        audience: { in: [audience, SupportTicketAudience.BOTH] },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, key: true, name: true, description: true, audience: true },
    })
  }

  async updateTicket(id: string, dto: UpdateSupportTicketDto) {
    this.logger.log(`Updating support ticket ${id}`)
    const existing = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { category: true },
    })
    if (!existing) {
      throw new NotFoundException('Support ticket not found')
    }

    let categoryId = existing.categoryId
    if (dto.categoryKey) {
      const category = await this.prisma.supportTicketCategory.findUnique({
        where: { key: dto.categoryKey },
      })
      if (!category) {
        throw new BadRequestException(`Support ticket category '${dto.categoryKey}' not found`)
      }
      categoryId = category.id
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        priority: dto.priority ?? existing.priority ?? SupportTicketPriority.NORMAL,
        tags: dto.tags ?? existing.tags,
        categoryId,
        bookingId: dto.bookingId ?? existing.bookingId,
        campId: dto.campId ?? existing.campId,
        sessionId: dto.sessionId ?? existing.sessionId,
      },
      include: {
        category: true,
        requesterUser: true,
        requesterProvider: true,
        assignedTo: true,
      },
    })

    return this.mapTicketToResponse(updated)
  }

  async updateTicketStatus(id: string, dto: UpdateSupportTicketStatusDto, currentUserId: string) {
    this.logger.log(`Updating status for support ticket ${id} to ${dto.status}`)
    const existing = await this.prisma.supportTicket.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new NotFoundException('Support ticket not found')
    }

    this.assertValidStatusTransition(existing.status, dto.status)

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: dto.status,
        resolvedAt: dto.status === SupportTicketStatus.RESOLVED ? new Date() : existing.resolvedAt,
        closedAt: dto.status === SupportTicketStatus.CLOSED ? new Date() : existing.closedAt,
        statusHistory: {
          create: {
            fromStatus: existing.status,
            toStatus: dto.status,
            changedByUserId: currentUserId,
          },
        },
      },
      include: {
        category: true,
        requesterUser: true,
        requesterProvider: true,
        assignedTo: true,
      },
    })

    const response = this.mapTicketToResponse(updated)

    // Emit ticket status update event for realtime UIs
    void this.redisPubSub
      .publishMessage('ticket:statusUpdated', {
        ticketId: response.id,
        status: response.status,
        resolvedAt: response.resolvedAt,
        closedAt: response.closedAt,
        updatedAt: response.updatedAt,
        changedByUserId: currentUserId,
        // Targeting: deliver only to the requester and assigned staff, not all sockets
        requesterUserId: updated.requesterUser?.id ?? null,
        assignedToUserId: updated.assignedTo?.id ?? null,
      })
      .catch(err => {
        this.logger.error('Failed to publish ticket status update event', err)
      })

    // Both audiences get a status-change entry; the
    // resolver scopes each to its own requester type (PARENT vs PROVIDER).
    notify(this.eventEmitter, NotificationType.ParentSupportTicketStatusChanged, {
      supportTicketId: updated.id,
    })
    notify(this.eventEmitter, NotificationType.ProviderSupportTicketStatusChanged, {
      supportTicketId: updated.id,
    })

    return response
  }

  async assignTicket(id: string, dto: AssignSupportTicketDto, currentUserId: string) {
    this.logger.log(`Assigning support ticket ${id} to ${dto.assignedToUserId || 'unassigned'}`)
    const existing = await this.prisma.supportTicket.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException('Support ticket not found')
    }

    const fromAssigneeUserId = existing.assignedToUserId
    const toAssigneeUserId = dto.assignedToUserId ?? null

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        assignedToUserId: toAssigneeUserId,
        assignedByUserId: currentUserId,
        assignedAt: new Date(),
        assignmentHistory: {
          create: {
            fromAssigneeUserId,
            toAssigneeUserId,
            changedByUserId: currentUserId,
          },
        },
      },
      include: {
        category: true,
        requesterUser: true,
        requesterProvider: true,
        assignedTo: true,
      },
    })

    const response = this.mapTicketToResponse(updated)

    // Emit ticket assignment event for realtime UIs
    void this.redisPubSub
      .publishMessage('ticket:assigned', {
        ticketId: response.id,
        assignedToUserId: toAssigneeUserId,
        assignedByUserId: currentUserId,
        assignedAt: response.assignedAt,
        // Targeting: deliver to requester, new assignee, and old assignee (if any)
        requesterUserId: updated.requesterUser?.id ?? null,
        fromAssigneeUserId: fromAssigneeUserId,
      })
      .catch(err => {
        this.logger.error('Failed to publish ticket assignment event', err)
      })

    return response
  }

  async reopenTicket(id: string, dto: ReopenSupportTicketDto, currentUserId: string) {
    this.logger.log(`Reopening support ticket ${id}`)
    const existing = await this.prisma.supportTicket.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException('Support ticket not found')
    }

    if (
      existing.status !== SupportTicketStatus.RESOLVED &&
      existing.status !== SupportTicketStatus.CLOSED
    ) {
      throw new BadRequestException('Only resolved or closed tickets can be reopened')
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: SupportTicketStatus.OPEN,
        reopenedCount: existing.reopenedCount + 1,
        lastReopenedAt: new Date(),
        lastReopenedByUserId: currentUserId,
        statusHistory: {
          create: {
            fromStatus: existing.status,
            toStatus: SupportTicketStatus.OPEN,
            changedByUserId: currentUserId,
            changeReason: dto.reason,
          },
        },
      },
      include: {
        category: true,
        requesterUser: true,
        requesterProvider: true,
        assignedTo: true,
      },
    })

    return this.mapTicketToResponse(updated)
  }

  async softDeleteTicket(id: string, currentUserId: string) {
    this.logger.log(`Soft deleting support ticket ${id} by user ${currentUserId}`)
    const existing = await this.prisma.supportTicket.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException('Support ticket not found')
    }

    await this.prisma.supportTicket.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    })

    return { success: true }
  }

  private assertValidStatusTransition(from: SupportTicketStatus, to: SupportTicketStatus): void {
    if (from === to) return

    const allowedMap: Record<SupportTicketStatus, SupportTicketStatus[]> = {
      [SupportTicketStatus.OPEN]: [
        SupportTicketStatus.IN_PROGRESS,
        SupportTicketStatus.PENDING_REQUESTER,
        SupportTicketStatus.PENDING_SUPPORT,
        SupportTicketStatus.RESOLVED,
        SupportTicketStatus.CLOSED,
      ],
      [SupportTicketStatus.IN_PROGRESS]: [
        SupportTicketStatus.PENDING_REQUESTER,
        SupportTicketStatus.PENDING_SUPPORT,
        SupportTicketStatus.RESOLVED,
        SupportTicketStatus.CLOSED,
      ],
      [SupportTicketStatus.PENDING_REQUESTER]: [
        SupportTicketStatus.IN_PROGRESS,
        SupportTicketStatus.RESOLVED,
        SupportTicketStatus.CLOSED,
      ],
      [SupportTicketStatus.PENDING_SUPPORT]: [
        SupportTicketStatus.IN_PROGRESS,
        SupportTicketStatus.RESOLVED,
        SupportTicketStatus.CLOSED,
      ],
      [SupportTicketStatus.RESOLVED]: [
        SupportTicketStatus.OPEN,
        SupportTicketStatus.IN_PROGRESS,
        SupportTicketStatus.CLOSED,
      ],
      [SupportTicketStatus.CLOSED]: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS],
    }

    const allowed = allowedMap[from] ?? []
    if (!allowed.includes(to)) {
      throw new BadRequestException(`Invalid status transition from ${from} to ${to}`)
    }
  }

  private async generateTicketNumber(
    tx: Prisma.TransactionClient,
    createdAt: Date
  ): Promise<string> {
    const tzDate = this.slaService.toZurichDate(createdAt)
    const yyyy = tzDate.getUTCFullYear()
    const mm = String(tzDate.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(tzDate.getUTCDate()).padStart(2, '0')
    const prefix = `WC-${yyyy}${mm}${dd}-`

    for (let attempt = 0; attempt < 3; attempt++) {
      const startOfDay = new Date(
        Date.UTC(yyyy, tzDate.getUTCMonth(), tzDate.getUTCDate(), 0, 0, 0)
      )
      const endOfDay = new Date(
        Date.UTC(yyyy, tzDate.getUTCMonth(), tzDate.getUTCDate(), 23, 59, 59, 999)
      )

      const count = await tx.supportTicket.count({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      })

      const seq = String(count + 1).padStart(4, '0')
      const candidate = `${prefix}${seq}`

      const existing = await tx.supportTicket.findUnique({
        where: { ticketNumber: candidate },
        select: { id: true },
      })

      if (!existing) {
        return candidate
      }
    }

    const random = String(Math.floor(1000 + Math.random() * 9000))
    return `${prefix}${random}`
  }

  private mapTicketToResponse(ticket: any) {
    const lastMsg = ticket.conversation?.lastMessage
    const lastMessage = lastMsg
      ? {
          id: lastMsg.id,
          content: lastMsg.content,
          senderId: lastMsg.senderId,
          senderType: lastMsg.senderType,
          sentAt: lastMsg.sentAt,
          sender: lastMsg.sender
            ? {
                id: lastMsg.sender.id,
                firstName: lastMsg.sender.firstName,
                lastName: lastMsg.sender.lastName,
              }
            : null,
        }
      : null

    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      description: ticket.description,
      lastMessage,
      requesterType: ticket.requesterType,
      requesterUser: ticket.requesterUser
        ? {
            id: ticket.requesterUser.id,
            firstName: ticket.requesterUser.firstName,
            lastName: ticket.requesterUser.lastName,
            email: ticket.requesterUser.email,
          }
        : null,
      requesterProvider: ticket.requesterProvider
        ? {
            id: ticket.requesterProvider.id,
            legalCompanyName: ticket.requesterProvider.legalCompanyName,
            email: ticket.requesterProvider.email,
          }
        : null,
      sourceApp: ticket.sourceApp,
      category: ticket.category
        ? {
            id: ticket.category.id,
            key: ticket.category.key,
            name: ticket.category.name,
            description: ticket.category.description,
            audience: ticket.category.audience,
          }
        : null,
      priority: ticket.priority,
      status: ticket.status,
      tags: ticket.tags ?? [],
      conversationId: ticket.conversationId,
      assignedToUser: ticket.assignedTo
        ? {
            id: ticket.assignedTo.id,
            firstName: ticket.assignedTo.firstName,
            lastName: ticket.assignedTo.lastName,
            email: ticket.assignedTo.email,
          }
        : null,
      assignedAt: ticket.assignedAt,
      slaPolicyId: ticket.slaPolicyId,
      firstResponseDueAt: ticket.firstResponseDueAt,
      firstRespondedAt: ticket.firstRespondedAt,
      resolutionDueAt: ticket.resolutionDueAt,
      resolvedAt: ticket.resolvedAt,
      closedAt: ticket.closedAt,
      slaFirstResponseBreachedAt: ticket.slaFirstResponseBreachedAt,
      slaResolutionBreachedAt: ticket.slaResolutionBreachedAt,
      resolvedByUserId: ticket.resolvedByUserId,
      resolutionCode: ticket.resolutionCode,
      resolutionSummary: ticket.resolutionSummary,
      closedByUserId: ticket.closedByUserId,
      closureReason: ticket.closureReason,
      reopenedCount: ticket.reopenedCount,
      lastReopenedAt: ticket.lastReopenedAt,
      lastReopenedByUserId: ticket.lastReopenedByUserId,
      lastRequesterReplyAt: ticket.lastRequesterReplyAt,
      lastSupportReplyAt: ticket.lastSupportReplyAt,
      bookingId: ticket.bookingId,
      campId: ticket.campId,
      sessionId: ticket.sessionId,
      satisfactionScore: ticket.satisfactionScore,
      satisfactionSubmittedAt: ticket.satisfactionSubmittedAt,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    }
  }
}
