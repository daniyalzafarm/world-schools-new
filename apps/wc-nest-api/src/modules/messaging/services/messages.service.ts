import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { NotificationType } from '@world-schools/wc-types'
import { PrismaService } from '../../../prisma/prisma.service'
import { notify } from '../../notifications/dispatcher/notify'
import { RedisService } from '../../redis/redis.service'
import { RedisPubSubService } from './redis-pub-sub.service'
import { ConversationsService } from './conversations.service'
import { AttachmentsService } from './attachments.service'
import {
  ContentType,
  ContextType,
  ConversationType,
  DeletionType,
  MessagePriority,
  MessageStatus,
  SenderType,
} from '../../../generated/client/client'
import {
  AddReactionDto,
  BookmarkMessageDto,
  DeleteMessageDto,
  EditMessageDto,
  ForwardMessageDto,
  GetMessagesDto,
  MarkAsDeliveredDto,
  MarkAsReadDto,
  PinMessageDto,
  RemoveReactionDto,
  ReportMessageDto,
  ScheduleMessageDto,
  SendMessageDto,
  UnbookmarkMessageDto,
  UnpinMessageDto,
} from '../interfaces/message.interface'

/** Shape of message attachment record when loaded from DB (paths; URLs built at read time) */
type MessageAttachmentRecord = {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  fileType: string
  storageUrl: string
  thumbnailUrl: string | null
}

/** Message with attachment relations for getMessages/getMessageById (join via forwardedFromId for forwards) */
type MessageWithAttachmentRelations = {
  messageAttachments: MessageAttachmentRecord[]
  forwardedFrom?: { messageAttachments: MessageAttachmentRecord[] } | null
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name)
  private readonly IDEMPOTENCY_TTL = 86400 // 24 hours

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private redisPubSub: RedisPubSubService,
    private conversationsService: ConversationsService,
    private attachmentsService: AttachmentsService,
    private eventEmitter: EventEmitter2
  ) {}

  /**
   * Send a new message with idempotency support
   */
  async sendMessage(dto: SendMessageDto) {
    const {
      conversationId,
      senderId,
      senderType,
      content,
      contentType = ContentType.TEXT,
      attachmentIds,
      replyToId,
      priority = MessagePriority.NORMAL,
      scheduledFor,
      idempotencyKey,
      tempId,
    } = dto

    // Check idempotency - prevent duplicate sends.
    // Key is scoped to conversationId to prevent cross-conversation key collisions.
    const cacheKey = `message:idempotency:${conversationId}:${idempotencyKey}`
    const existing = await this.redis.get(cacheKey)
    if (existing) {
      this.logger.debug(`Idempotency hit for key: ${idempotencyKey}`)
      return JSON.parse(existing)
    }

    // Resolve attachment records (if any) before creating the message
    // We only allow associating attachments that:
    // - Exist
    // - Were uploaded by the same sender
    // - Are not yet linked to another message (messageId is an empty string)
    let attachmentRecords:
      | {
          id: string
          fileName: string
          fileSize: number
          mimeType: string
          fileType: string
          storageUrl: string
          thumbnailUrl: string | null
        }[]
      | null = null

    if (attachmentIds && attachmentIds.length > 0) {
      attachmentRecords = await this.prisma.messageAttachment.findMany({
        where: {
          id: { in: attachmentIds },
          uploadedBy: senderId,
          messageId: { equals: null }, // not yet attached to a message (upload-then-send)
        },
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          fileType: true,
          storageUrl: true,
          thumbnailUrl: true,
        },
      })

      if (attachmentRecords?.length !== attachmentIds.length) {
        throw new BadRequestException(
          'One or more attachments are invalid, already attached, or not owned by the sender'
        )
      }
    }

    // Determine final contentType:
    // - If explicitly provided, respect it.
    // - Otherwise, infer from attachments (if any).
    // - Fallback to TEXT when no attachments.
    let resolvedContentType = contentType
    if (!resolvedContentType && attachmentRecords && attachmentRecords.length > 0) {
      const mimeTypes = attachmentRecords.map(a => a.mimeType || '')
      if (mimeTypes.every(m => m.startsWith('image/'))) {
        resolvedContentType = ContentType.IMAGE
      } else if (mimeTypes.every(m => m.startsWith('audio/'))) {
        resolvedContentType = ContentType.AUDIO
      } else if (mimeTypes.every(m => m.startsWith('video/'))) {
        resolvedContentType = ContentType.VIDEO
      } else {
        resolvedContentType = ContentType.FILE
      }
    }
    if (!resolvedContentType) {
      resolvedContentType = ContentType.TEXT
    }

    // Parse mentions from content (@username)
    const mentions = this.parseMentions(content)

    // Track if conversation was auto-assigned
    let wasAutoAssigned = false

    // ✅ PHASE 4 FIX: Wrap transaction in try-catch for proper error handling
    try {
      // Create message with transaction
      const message = await this.prisma.$transaction(async tx => {
        const msg = await tx.message.create({
          data: {
            conversationId,
            senderId,
            senderType,
            content,
            contentType: resolvedContentType,
            replyToId,
            priority,
            scheduledFor,
            isScheduled: !!scheduledFor,
            status: scheduledFor ? MessageStatus.SENDING : MessageStatus.SENT,
            ...(scheduledFor ? {} : { sentAt: new Date() }),
            // Attachments are stored only in MessageAttachment table (single source of truth)
          },
          include: {
            sender: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            replyTo: {
              select: { id: true, content: true, senderId: true },
            },
          },
        })

        // Associate attachment records with this message (link message_id so it persists)
        if (attachmentRecords && attachmentRecords.length > 0) {
          for (const attachment of attachmentRecords) {
            await tx.messageAttachment.update({
              where: { id: attachment.id },
              data: { messageId: msg.id },
            })
          }
        }

        // Create mentions if any
        if (mentions.length > 0) {
          await tx.messageMention.createMany({
            data: mentions.map(userId => ({
              messageId: msg.id,
              userId,
            })),
          })
        }

        // Fetch conversation once for auto-assign + support ticket checks
        const conv = await tx.conversation.findUnique({
          where: { id: conversationId },
          select: { assignedToId: true, type: true, contextType: true },
        })

        // Auto-assign conversation if this is first provider reply
        // This ensures provider conversations are automatically assigned to the first provider who responds
        if (
          senderType === SenderType.PROVIDER &&
          conv &&
          !conv.assignedToId &&
          conv.type === ConversationType.USER_PROVIDER
        ) {
          await tx.conversation.update({
            where: { id: conversationId },
            data: {
              assignedToId: senderId,
              assignedBy: senderId,
              assignedAt: new Date(),
            },
          })
          wasAutoAssigned = true
          this.logger.log(
            `Auto-assigned conversation ${conversationId} to provider ${senderId} on first reply`
          )
        }

        // Update conversation last message and metrics
        await tx.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessageId: msg.id,
            updatedAt: new Date(),
            lastActivityAt: new Date(),
            messageCount: { increment: 1 },
          },
        })

        // Increment unread count for other participants
        await tx.conversationParticipant.updateMany({
          where: {
            conversationId,
            userId: { not: senderId },
          },
          data: {
            unreadCount: { increment: 1 },
          },
        })

        // Set firstRespondedAt on linked support ticket for the first non-requester reply.
        // Atomic with message creation so SLA timestamps are always consistent.
        if (conv?.contextType === ContextType.SUPPORT_TICKET) {
          await tx.supportTicket.updateMany({
            where: {
              conversationId,
              firstRespondedAt: null,
              createdByUserId: { not: senderId },
            },
            data: { firstRespondedAt: new Date() },
          })
        }

        return msg
      })

      // Build attachments for response/events from MessageAttachment relation (single source of truth)
      const attachmentList =
        attachmentRecords?.map(a => ({
          id: a.id,
          fileName: a.fileName,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
          fileType: a.fileType,
          url: a.storageUrl,
          thumbnailUrl: a.thumbnailUrl ?? null,
        })) ?? []
      if (attachmentList.length > 0) {
        ;(message as { attachments?: unknown }).attachments =
          await this.attachmentsService.resolveMessageAttachmentsUrls(attachmentList)
      } else {
        ;(message as { attachments?: unknown }).attachments = null
      }

      // ✅ PHASE 4 FIX: Only cache after successful transaction
      await this.redis.setex(cacheKey, this.IDEMPOTENCY_TTL, JSON.stringify(message))

      // ✅ PHASE 2 FIX: Get conversation with participants for cache invalidation
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { participants: true },
      })

      if (!conversation) {
        throw new NotFoundException('Conversation not found')
      }

      // v28 catalog dispatch — outbound parent-facing notification when the
      // sender is the provider side of a camp DM or the support side of a
      // support ticket. Resolver filters out provider participants + the
      // sender, so a parent-authored message never re-notifies the sender.
      if (senderType === SenderType.PROVIDER) {
        if (conversation.contextType === ContextType.SUPPORT_TICKET) {
          const ticket = conversation.contextId
            ? await this.prisma.supportTicket.findFirst({
                where: { conversationId },
                select: { id: true },
              })
            : null
          if (ticket) {
            notify(this.eventEmitter, NotificationType.ParentSupportTicketReply, {
              supportTicketId: ticket.id,
              conversationId,
              messageId: message.id,
            })
            // v28 Phase 9 — superadmin mirror so the assigned support
            // agent sees the requester reply alongside parent/provider.
            notify(this.eventEmitter, NotificationType.SuperadminSupportTicketReply, {
              supportTicketId: ticket.id,
              conversationId,
              messageId: message.id,
            })
          }
        } else {
          notify(this.eventEmitter, NotificationType.ParentMessagingNewFromCamp, {
            conversationId,
            messageId: message.id,
          })
        }
      } else if (senderType === SenderType.USER) {
        // v28 Phase 8 — provider mirror for parent → camp DMs, plus the
        // provider-as-requester support-reply path. Resolver filters out
        // the sender + parent participants so a provider doesn't get
        // notified about their own message.
        if (conversation.contextType === ContextType.SUPPORT_TICKET) {
          const ticket = conversation.contextId
            ? await this.prisma.supportTicket.findFirst({
                where: { conversationId },
                select: { id: true, requesterType: true },
              })
            : null
          if (ticket?.requesterType === 'PROVIDER') {
            notify(this.eventEmitter, NotificationType.ProviderSupportTicketReply, {
              supportTicketId: ticket.id,
              conversationId,
              messageId: message.id,
            })
          }
          if (ticket) {
            // v28 Phase 9 — superadmin mirror for any USER reply in a
            // support-ticket conversation (parent requester or provider
            // requester). Fires alongside the audience-specific notify.
            notify(this.eventEmitter, NotificationType.SuperadminSupportTicketReply, {
              supportTicketId: ticket.id,
              conversationId,
              messageId: message.id,
            })
          }
        } else {
          // Use conversation.metadata.providerId when available — the
          // `metadata` JSON column carries it for USER_PROVIDER convos.
          const meta = conversation.metadata as { providerId?: string } | null
          notify(this.eventEmitter, NotificationType.ProviderMessagingNewFromFamily, {
            conversationId,
            messageId: message.id,
            providerId: meta?.providerId,
          })
        }
      }

      // Invalidate conversation cache for all direct participants in parallel
      const participantUserIds = conversation.participants.map(p => p.userId)
      await Promise.all(
        participantUserIds.map(uid => this.conversationsService.invalidateConversationCache(uid))
      )

      // For provider conversations, also invalidate provider org users in parallel.
      // The cross-replica pub/sub broadcast below covers all other replicas;
      // the Promise.all here covers the current replica immediately.
      const metadata = conversation.metadata as { providerId?: string } | null
      if (conversation.type === ConversationType.USER_PROVIDER && metadata?.providerId) {
        const providerUsers = await this.redisPubSub.getProviderUsers(metadata.providerId)
        await Promise.all(
          providerUsers.map(u => this.conversationsService.invalidateConversationCache(u.id))
        )

        // Broadcast to all replicas
        await this.redisPubSub.publishMessage('cache:invalidate:conversations', {
          userIds: participantUserIds,
          providerId: metadata.providerId,
        })
      } else {
        // Broadcast to all replicas
        await this.redisPubSub.publishMessage('cache:invalidate:conversations', {
          userIds: participantUserIds,
        })
      }

      // ✅ PHASE 2 FIX: Invalidate message cache for this conversation
      await this.invalidateMessageCache(conversationId)

      // ✅ PHASE 2 FIX: Broadcast message cache invalidation to all replicas
      await this.redisPubSub.publishMessage('cache:invalidate:messages', {
        conversationId,
      })

      // ✅ PHASE 2 FIX: Invalidate metrics cache for this conversation
      const metricsKey = `conversation:metrics:${conversationId}`
      await this.redis.del(metricsKey)

      // ✅ PHASE 2 FIX: Broadcast metrics cache invalidation to all replicas
      await this.redisPubSub.publishMessage('cache:invalidate:metrics', {
        conversationId,
      })

      this.logger.debug(
        `Cache invalidated for conversation ${conversationId} and ${participantUserIds.length} participants`
      )

      // ✅ PHASE 4 FIX: Pub/sub failure doesn't affect message save (eventual consistency)
      // PHASE 5: Publish to Redis for real-time delivery
      const publishStartTime = Date.now()
      await this.redisPubSub
        .publishMessage('messages:new', {
          conversationId: message.conversationId,
          message: {
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            senderType: message.senderType,
            content: message.content,
            contentType: message.contentType,
            status: message.status,
            priority: message.priority,
            replyToId: message.replyToId,
            attachments: (message as { attachments?: unknown }).attachments,
            sentAt: message.sentAt,
            createdAt: message.createdAt,
            sender: message.sender,
            replyTo: message.replyTo,
          },
          // ✅ Include recipient info so Redis subscriber can broadcast to user rooms
          recipientUserIds: participantUserIds.filter(id => id !== senderId),
          providerId: metadata?.providerId,
          senderId,
          // tempId for optimistic update deduplication on the sender's conversation room subscription
          tempId,
          // Track delivery latency for monitoring
          publishedAt: new Date().toISOString(),
          latencyMs: Date.now() - publishStartTime,
        })
        .catch(err => {
          this.logger.error('Failed to publish message event, but message was saved', err)
        })

      this.logger.log(
        `Message sent: ${message.id} in conversation: ${conversationId} (publish latency: ${Date.now() - publishStartTime}ms)`
      )

      // Broadcast assignment event if conversation was auto-assigned
      if (wasAutoAssigned) {
        await this.redisPubSub
          .publishMessage('conversation:assigned', {
            conversationId,
            assignedToId: senderId,
            assignedBy: senderId,
            assignedAt: new Date().toISOString(),
            autoAssigned: true,
          })
          .catch(err => {
            this.logger.error('Failed to publish assignment event, but message was saved', err)
          })
        this.logger.log(`Broadcasted auto-assignment event for conversation ${conversationId}`)
      }

      return message
    } catch (error) {
      // ✅ PHASE 4 FIX: Don't cache on error
      this.logger.error('Failed to send message', error)
      throw error
    }
  }

  /**
   * Create a message via WebSocket
   *
   * Validates that the sender is a participant in the conversation,
   * determines sender type from participant data (USER vs PROVIDER),
   * applies Redis-based rate limiting (10 messages per minute per user per conversation),
   * then delegates to the existing sendMessage() method.
   *
   * For USER_PROVIDER conversations, provider users may not yet be in the
   * conversationParticipant table (the org is referenced via metadata.providerId).
   * In that case, we verify organization membership, auto-add the provider user
   * as a participant, and allow the message through. The subsequent sendMessage()
   * call handles auto-assignment of the conversation.
   *
   * Rate limiting uses Redis INCR + EXPIRE for O(1) latency (~1-5ms)
   * instead of a DB COUNT query (~50ms). Keys auto-expire via TTL.
   */
  async createMessageViaWebSocket(data: {
    conversationId: string
    senderId: string
    content: string
    tempId: string
    attachmentIds?: string[]
  }) {
    // Validate user is a participant and determine sender type
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId: data.conversationId,
        userId: data.senderId,
      },
      select: {
        id: true,
        providerId: true,
      },
    })

    let senderType: SenderType

    if (participant) {
      // User is a direct participant — determine sender type from participant data
      senderType = participant.providerId ? SenderType.PROVIDER : SenderType.USER
    } else {
      // User is NOT a direct participant — check provider-level access
      senderType = await this.resolveProviderAccessAndAddParticipant(
        data.conversationId,
        data.senderId
      )
    }

    // Rate limiting via Redis (prevent spam) - 10 messages per minute per user per conversation
    // Uses Redis INCR + EXPIRE for O(1) latency (~1-5ms) instead of DB COUNT query (~50ms)
    const RATE_LIMIT_MAX = 10
    const RATE_LIMIT_WINDOW = 60 // seconds
    const rateLimitKey = `ratelimit:ws:msg:${data.senderId}:${data.conversationId}`

    try {
      const redisClient = this.redis.getClient()
      const count = await redisClient.incr(rateLimitKey)

      // Set TTL on first request in the window — key auto-expires after 60s
      if (count === 1) {
        await redisClient.expire(rateLimitKey, RATE_LIMIT_WINDOW)
      }

      if (count > RATE_LIMIT_MAX) {
        this.logger.warn(
          `WebSocket rate limit exceeded for user ${data.senderId} in conversation ${data.conversationId}: ${count}/${RATE_LIMIT_MAX} in ${RATE_LIMIT_WINDOW}s`
        )
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Rate limit exceeded. You can send up to ${RATE_LIMIT_MAX} messages per minute via WebSocket.`,
            error: 'Too Many Requests',
            retryAfter: RATE_LIMIT_WINDOW,
          },
          HttpStatus.TOO_MANY_REQUESTS
        )
      }
    } catch (error) {
      // Re-throw rate limit exceptions
      if (error instanceof HttpException) {
        throw error
      }
      // Fail open on Redis errors — log and allow the message through
      this.logger.error(`Redis rate limit check failed for user ${data.senderId}:`, error)
    }

    // Delegate to existing sendMessage() with proper DTO
    return this.sendMessage({
      conversationId: data.conversationId,
      senderId: data.senderId,
      senderType,
      content: data.content,
      idempotencyKey: data.tempId,
      tempId: data.tempId,
      ...(data.attachmentIds?.length ? { attachmentIds: data.attachmentIds } : {}),
    })
  }

  /**
   * Check if a non-participant user has provider-level access to a conversation.
   *
   * For USER_PROVIDER conversations, provider users are not added as participants
   * when the conversation is created — only the booking user is. Provider users
   * see conversations through their organization (metadata.providerId).
   *
   * If the user belongs to the provider organization referenced in the
   * conversation's metadata.providerId, they are allowed to send messages
   * and are automatically added as a participant so that subsequent messages
   * pass the direct participant check.
   *
   * @returns SenderType.PROVIDER if access is granted
   * @throws NotFoundException if the conversation does not exist
   * @throws ForbiddenException if the user has no access
   */
  private async resolveProviderAccessAndAddParticipant(
    conversationId: string,
    userId: string
  ): Promise<SenderType> {
    // Fetch conversation to check type and metadata
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        type: true,
        metadata: true,
      },
    })

    if (!conversation) {
      throw new NotFoundException('Conversation not found')
    }

    // Only allow this fallback for USER_PROVIDER conversations
    if (conversation.type !== ConversationType.USER_PROVIDER) {
      throw new ForbiddenException('User is not a participant in this conversation')
    }

    const metadata = conversation.metadata as { providerId?: string } | null
    if (!metadata?.providerId) {
      throw new ForbiddenException('User is not a participant in this conversation')
    }

    // Check if user belongs to the provider organization
    const userProviderId = await this.conversationsService.getProviderIdForUser(userId)

    if (!userProviderId || userProviderId !== metadata.providerId) {
      throw new ForbiddenException('User is not a participant in this conversation')
    }

    // Provider user has organization-level access — add them as a participant
    // so that subsequent messages pass the direct participant check and
    // unread-count tracking works correctly.
    await this.prisma.conversationParticipant.create({
      data: {
        conversationId,
        userId,
        providerId: userProviderId,
      },
    })

    this.logger.log(
      `Auto-added provider user ${userId} as participant in conversation ${conversationId} (provider: ${userProviderId})`
    )

    return SenderType.PROVIDER
  }

  /**
   * Assert that a user has access to a conversation (participant or provider org for USER_PROVIDER).
   * Throws NotFoundException if conversation does not exist, ForbiddenException if no access.
   */
  private async assertConversationAccess(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, type: true, metadata: true },
    })

    if (!conversation) {
      this.logger.warn(`Conversation ${conversationId} not found`)
      throw new NotFoundException('Conversation not found')
    }

    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId },
      select: { id: true },
    })

    if (participant) return

    if (conversation.type === ConversationType.USER_PROVIDER) {
      const metadata = conversation.metadata as { providerId?: string } | null
      if (metadata?.providerId) {
        const userProviderId = await this.conversationsService.getProviderIdForUser(userId)
        if (userProviderId && userProviderId === metadata.providerId) return
      }
    }

    this.logger.warn(
      `User ${userId} attempted to access conversation ${conversationId} without permission`
    )
    throw new ForbiddenException('You do not have permission to access this conversation')
  }

  /**
   * Get messages with cursor-based pagination.
   * When accessUserId is provided, verifies the user has access to the conversation before returning messages.
   */
  async getMessages(dto: GetMessagesDto, accessUserId?: string) {
    const { conversationId, limit = 50, cursor, direction = 'before' } = dto

    if (accessUserId) {
      await this.assertConversationAccess(conversationId, accessUserId)
    }

    // ✅ PHASE 4 FIX: Check cache first
    const cacheKey = `messages:${conversationId}:${limit}:${cursor || 'initial'}:${direction}`
    const cached = await this.redis.get(cacheKey)
    if (cached) {
      this.logger.log({
        event: 'cache.messages.hit',
        direction,
        conversationId,
        cacheKey,
      })
      this.logger.debug(`Cache hit for messages: ${cacheKey}`)
      const parsed = JSON.parse(cached)
      if (!parsed.data || !Array.isArray(parsed.data)) return parsed
      const dataWithUrls = await Promise.all(
        parsed.data.map(
          async (m: { attachments?: Array<{ url: string; thumbnailUrl?: string | null }> }) =>
            m.attachments && Array.isArray(m.attachments) && m.attachments.length > 0
              ? {
                  ...m,
                  attachments: await this.attachmentsService.resolveMessageAttachmentsUrls(
                    m.attachments as Array<{ url: string; thumbnailUrl?: string | null }>
                  ),
                }
              : { ...m }
        )
      )
      return { ...parsed, data: dataWithUrls }
    }

    // ✅ PHASE 5 FIX: Track cache miss
    this.logger.log({
      event: 'cache.messages.miss',
      direction,
      conversationId,
      cacheKey,
    })

    const where: any = {
      conversationId,
      isDeleted: false,
    }

    // Determine sort order:
    // - Initial load (no cursor): descending order (newest first) so the client always
    //   sees the most recent messages on first render. The client reverses the array
    //   before display so the visual order remains oldest-at-top.
    //   nextCursor points to the oldest message in the batch — fetchMoreMessages then
    //   uses direction:'before' to load even older history (scroll-up pagination).
    // - Pagination with cursor: use direction parameter
    const isInitialLoad = !cursor
    const sortOrder = isInitialLoad ? 'desc' : direction === 'before' ? 'desc' : 'asc'

    // Cursor-based pagination using composite index
    if (cursor) {
      const cursorMessage = await this.prisma.message.findUnique({
        where: { id: cursor },
        select: { createdAt: true, id: true },
      })

      if (!cursorMessage) {
        // Cursor message was deleted. Signal the client to reset to page 1.
        throw new BadRequestException('CURSOR_NOT_FOUND')
      }

      where.OR = [
        {
          createdAt:
            direction === 'before'
              ? { lt: cursorMessage.createdAt }
              : { gt: cursorMessage.createdAt },
        },
        {
          createdAt: cursorMessage.createdAt,
          id: direction === 'before' ? { lt: cursor } : { gt: cursor },
        },
      ]
    }

    // Fetch one extra message to determine if there are more
    // Include messageAttachments; for forwards use original message's attachments (join via forwardedFromId)
    const messagesInclude = {
      sender: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      readReceipts: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      deliveryReceipts: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      reactions: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      mentions: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      replyTo: {
        select: { id: true, content: true, senderId: true },
      },
      messageAttachments: true,
      forwardedFrom: { select: { messageAttachments: true } },
    }
    const messages = await this.prisma.message.findMany({
      where,
      include: messagesInclude as any,
      orderBy: [{ createdAt: sortOrder }, { id: sortOrder }],
      take: limit + 1, // Fetch one extra to check if there are more
    })

    // Check if there are more messages
    const hasMore = messages.length > limit
    const rawData = hasMore ? messages.slice(0, limit) : messages

    // Build attachments from relation (for forwards use original message's attachments)
    const data = rawData.map((m: unknown) => {
      const msg = m as MessageWithAttachmentRelations & Record<string, unknown>
      const source = msg.forwardedFrom?.messageAttachments ?? msg.messageAttachments ?? []
      const attachments =
        source.length > 0
          ? source.map((a: MessageAttachmentRecord) => ({
              id: a.id,
              fileName: a.fileName,
              fileSize: a.fileSize,
              mimeType: a.mimeType,
              fileType: a.fileType,
              url: a.storageUrl,
              thumbnailUrl: a.thumbnailUrl ?? null,
            }))
          : null
      const { messageAttachments: _ma, forwardedFrom: _ff, ...rest } = msg
      return { ...rest, attachments }
    })

    // Get the cursor for the next page (last message ID)
    const lastMessage = data.length > 0 ? data[data.length - 1] : null
    const nextCursor = hasMore && lastMessage ? (lastMessage as unknown as { id: string }).id : null

    const result = {
      data,
      nextCursor,
      hasMore,
    }

    // ✅ PHASE 4 FIX: Cache the result for 5 minutes (cache stores paths, not URLs)
    await this.redis.setex(cacheKey, 300, JSON.stringify(result))
    this.logger.debug(`Cached messages: ${cacheKey}`)

    // Build attachment URLs for response (paths stored in DB, like camp images)
    const dataWithUrls = await Promise.all(
      result.data.map(async m =>
        m.attachments && Array.isArray(m.attachments) && m.attachments.length > 0
          ? {
              ...m,
              attachments: await this.attachmentsService.resolveMessageAttachmentsUrls(
                m.attachments as Array<{ url: string; thumbnailUrl?: string | null }>
              ),
            }
          : { ...m }
      )
    )
    return { ...result, data: dataWithUrls }
  }

  /**
   * Get a single message by ID
   */
  async getMessageById(messageId: string) {
    const cacheKey = `message:${messageId}`
    const cached = await this.redis.get(cacheKey)
    if (cached) {
      const message = JSON.parse(cached)
      if (
        message.attachments &&
        Array.isArray(message.attachments) &&
        message.attachments.length > 0
      ) {
        message.attachments = await this.attachmentsService.resolveMessageAttachmentsUrls(
          message.attachments as Array<{ url: string; thumbnailUrl?: string | null }>
        )
      }
      return message
    }

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        readReceipts: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        deliveryReceipts: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        reactions: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        mentions: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        replyTo: {
          select: { id: true, content: true, senderId: true },
        },
        editHistory: {
          orderBy: { editedAt: 'desc' },
        },
        messageAttachments: true,
        forwardedFrom: { select: { messageAttachments: true } },
      } as any,
    })

    if (!message) {
      throw new NotFoundException('Message not found')
    }

    const msg = message as MessageWithAttachmentRelations & typeof message
    const source = msg.forwardedFrom?.messageAttachments ?? msg.messageAttachments ?? []
    const attachmentsRaw =
      source.length > 0
        ? source.map((a: MessageAttachmentRecord) => ({
            id: a.id,
            fileName: a.fileName,
            fileSize: a.fileSize,
            mimeType: a.mimeType,
            fileType: a.fileType,
            url: a.storageUrl,
            thumbnailUrl: a.thumbnailUrl ?? null,
          }))
        : null
    const { messageAttachments: _ma, forwardedFrom: _ff, ...rest } = msg
    const toCache = { ...rest, attachments: attachmentsRaw }
    await this.redis.setex(cacheKey, 300, JSON.stringify(toCache))
    const resolved =
      attachmentsRaw && attachmentsRaw.length > 0
        ? await this.attachmentsService.resolveMessageAttachmentsUrls(attachmentsRaw)
        : null
    return { ...rest, attachments: resolved }
  }

  /**
   * Edit a message with history tracking
   */
  async editMessage(dto: EditMessageDto) {
    const { messageId, userId, newContent, editReason } = dto

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    })

    if (!message) {
      throw new NotFoundException('Message not found')
    }

    if (message.senderId !== userId) {
      throw new BadRequestException('You can only edit your own messages')
    }

    if (message.isDeleted) {
      throw new BadRequestException('Cannot edit deleted message')
    }

    // Update message with transaction
    const updated = await this.prisma.$transaction(async tx => {
      // Create edit history entry
      await tx.messageEditHistory.create({
        data: {
          messageId,
          previousContent: message.content,
          editedBy: userId,
          editReason,
        },
      })

      // Update message
      return await tx.message.update({
        where: { id: messageId },
        data: {
          content: newContent,
          editedAt: new Date(),
        },
        include: {
          editHistory: {
            orderBy: { editedAt: 'desc' },
          },
        },
      })
    })

    // ✅ PHASE 4 FIX: Invalidate message cache
    await this.redis.del(`message:${messageId}`)
    await this.invalidateMessageCache(message.conversationId)

    // ✅ PHASE 4 FIX: Broadcast cache invalidation
    await this.redisPubSub.publishMessage('cache:invalidate:messages', {
      conversationId: message.conversationId,
    })

    // Broadcast the edit to all participants in real time (the Redis→socket
    // bridge re-emits this channel as `message:updated` to the conversation room).
    await this.redisPubSub
      .publishMessage('messages:updated', {
        conversationId: message.conversationId,
        messageId,
        content: newContent,
        editedAt: updated.editedAt?.toISOString(),
      })
      .catch(err => this.logger.error('Failed to publish messages:updated', err))

    this.logger.log(`Message edited: ${messageId} by user: ${userId}`)
    return updated
  }

  /**
   * Soft delete a message with audit trail
   */
  async deleteMessage(dto: DeleteMessageDto) {
    const { messageId, userId, deletionType = DeletionType.USER_DELETED } = dto

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    })

    if (!message) {
      throw new NotFoundException('Message not found')
    }

    if (message.senderId !== userId) {
      throw new BadRequestException('You can only delete your own messages')
    }

    const deleted = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
        deletionType,
      },
    })

    // ✅ PHASE 4 FIX: Invalidate message cache
    await this.redis.del(`message:${messageId}`)
    await this.invalidateMessageCache(message.conversationId)

    // ✅ PHASE 4 FIX: Broadcast cache invalidation
    await this.redisPubSub.publishMessage('cache:invalidate:messages', {
      conversationId: message.conversationId,
    })

    // Broadcast the deletion to all participants in real time (the Redis→socket
    // bridge re-emits this channel as `message:deleted` to the conversation room).
    await this.redisPubSub
      .publishMessage('messages:deleted', {
        conversationId: message.conversationId,
        messageId,
      })
      .catch(err => this.logger.error('Failed to publish messages:deleted', err))

    this.logger.log(`Message deleted: ${messageId} by user: ${userId} (${deletionType})`)
    return deleted
  }

  /**
   * Mark message as read
   * PHASE 5: Enhanced with Redis pub/sub and lastReadAt update
   */
  async markAsRead(dto: MarkAsReadDto) {
    const { messageId, userId } = dto

    // Use transaction to ensure atomicity
    const result = await this.prisma.$transaction(async tx => {
      // Fetch message first (needed for ownership + participant update)
      const message = await tx.message.findUnique({
        where: { id: messageId },
        select: { conversationId: true, senderId: true },
      })

      if (!message) {
        throw new NotFoundException(`Message ${messageId} not found`)
      }

      // Avoid rewriting read receipts (and spamming cache invalidation) when already read.
      const existingReceipt = await tx.messageReadReceipt.findUnique({
        where: { messageId_userId: { messageId, userId } },
        select: { readAt: true },
      })

      const receipt = existingReceipt
        ? { readAt: existingReceipt.readAt, created: false }
        : {
            readAt: (await tx.messageReadReceipt.create({ data: { messageId, userId } })).readAt,
            created: true,
          }

      // Transition message status to READ and set readAt timestamp (only if not already READ)
      await tx.message.updateMany({
        where: { id: messageId, status: { not: MessageStatus.READ } },
        data: { status: MessageStatus.READ, readAt: new Date() },
      })

      // Decrement unread count and update lastReadAt for participant
      const participantUpdate = await tx.conversationParticipant.updateMany({
        where: {
          conversationId: message.conversationId,
          userId,
          unreadCount: { gt: 0 },
        },
        data: {
          unreadCount: { decrement: 1 },
          lastReadAt: new Date(),
        },
      })

      return { receipt, message, unreadChanged: participantUpdate.count > 0 }
    })

    // If nothing changed, bail early (prevents log/redis spam on large conversations)
    if (!result.receipt.created && !result.unreadChanged) {
      return { readAt: result.receipt.readAt }
    }

    // PHASE 5: Broadcast read receipt via Redis pub/sub
    await this.redisPubSub.publishMessage('receipts:read', {
      messageId,
      conversationId: result.message.conversationId,
      userId,
      readAt: result.receipt.readAt.toISOString(),
      senderId: result.message.senderId,
    })

    // ✅ PHASE 3 FIX: Invalidate conversation cache for user (unread count changed)
    await this.conversationsService.invalidateConversationCache(userId)

    // ✅ PHASE 3 FIX: Invalidate metrics cache
    await this.redis.del(`conversation:metrics:${result.message.conversationId}`)

    // ✅ PHASE 3 FIX: Broadcast cache invalidation to all replicas
    await this.redisPubSub.publishMessage('cache:invalidate:conversations', {
      userIds: [userId],
    })

    await this.redisPubSub.publishMessage('cache:invalidate:metrics', {
      conversationId: result.message.conversationId,
    })

    this.logger.debug(`Message ${messageId} marked as read by user ${userId}`)
    return { readAt: result.receipt.readAt }
  }

  /**
   * Mark message as delivered
   * PHASE 5: Enhanced with Redis pub/sub and delivery latency tracking
   */
  async markAsDelivered(dto: MarkAsDeliveredDto) {
    const { messageId, userId, deliveryLatencyMs } = dto

    const deliveryStartTime = Date.now()

    // Use transaction to ensure atomicity
    const result = await this.prisma.$transaction(async tx => {
      // Get message details
      const message = await tx.message.findUnique({
        where: { id: messageId },
        select: { conversationId: true, senderId: true, sentAt: true },
      })

      if (!message) {
        throw new NotFoundException(`Message ${messageId} not found`)
      }

      // Avoid rewriting delivery receipts when already delivered.
      const existingReceipt = await tx.messageDeliveryReceipt.findUnique({
        where: { messageId_userId: { messageId, userId } },
        select: { deliveredAt: true },
      })

      const receipt = existingReceipt
        ? { deliveredAt: existingReceipt.deliveredAt, created: false }
        : {
            deliveredAt: (await tx.messageDeliveryReceipt.create({ data: { messageId, userId } }))
              .deliveredAt,
            created: true,
          }

      // Update message status to DELIVERED and set deliveredAt if not already DELIVERED or READ
      const statusUpdate = await tx.message.updateMany({
        where: {
          id: messageId,
          status: MessageStatus.SENT,
        },
        data: {
          status: MessageStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      })

      return { receipt, message, statusChanged: statusUpdate.count > 0 }
    })

    // If nothing changed, bail early (prevents log/redis spam on large conversations)
    if (!result.receipt.created && !result.statusChanged) {
      return { deliveredAt: result.receipt.deliveredAt }
    }

    // Calculate total delivery latency (from sent to delivered)
    const totalLatencyMs =
      deliveryLatencyMs ??
      (result.message.sentAt ? Date.now() - new Date(result.message.sentAt).getTime() : undefined)

    // PHASE 5: Broadcast delivery receipt via Redis pub/sub
    await this.redisPubSub.publishMessage('receipts:delivered', {
      messageId,
      conversationId: result.message.conversationId,
      userId,
      deliveredAt: result.receipt.deliveredAt.toISOString(),
      senderId: result.message.senderId,
      deliveryLatencyMs: totalLatencyMs,
      processingLatencyMs: Date.now() - deliveryStartTime,
    })

    // ✅ PHASE 3 FIX: Invalidate conversation cache for user
    await this.conversationsService.invalidateConversationCache(userId)

    // ✅ PHASE 3 FIX: Invalidate metrics cache
    await this.redis.del(`conversation:metrics:${result.message.conversationId}`)

    // ✅ PHASE 3 FIX: Broadcast cache invalidation to all replicas
    await this.redisPubSub.publishMessage('cache:invalidate:conversations', {
      userIds: [userId],
    })

    await this.redisPubSub.publishMessage('cache:invalidate:metrics', {
      conversationId: result.message.conversationId,
    })

    this.logger.debug(
      `Message ${messageId} marked as delivered to user ${userId} (latency: ${totalLatencyMs}ms)`
    )
    return result.receipt
  }

  /**
   * Bulk-mark all SENT messages as delivered for a user.
   * Called on WebSocket connect so offline messages get delivery receipts
   * before the user opens any conversation (WhatsApp/Signal model).
   */
  async markAllDelivered(userId: string): Promise<void> {
    const pendingMessages = await this.prisma.message.findMany({
      where: {
        status: MessageStatus.SENT,
        senderId: { not: userId },
        conversation: {
          participants: { some: { userId } },
        },
      },
      select: { id: true, conversationId: true },
    })

    for (const msg of pendingMessages) {
      await this.markAsDelivered({ messageId: msg.id, userId }).catch(err =>
        this.logger.warn(`markAllDelivered: skipped ${msg.id} — ${(err as Error).message}`)
      )
    }
  }

  /**
   * Add reaction to message
   * PHASE 6: Enhanced with Redis pub/sub for real-time updates
   */
  async addReaction(dto: AddReactionDto) {
    const { messageId, userId, emoji } = dto

    // Get message details for broadcasting
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true, senderId: true },
    })

    if (!message) {
      throw new NotFoundException('Message not found')
    }

    // Create reaction (unique constraint prevents duplicates)
    const reaction = await this.prisma.messageReaction.create({
      data: {
        messageId,
        userId,
        emoji,
      },
    })

    // ✅ PHASE 4 FIX: Invalidate message cache (reactions changed)
    await this.redis.del(`message:${messageId}`)
    await this.invalidateMessageCache(message.conversationId)

    // ✅ PHASE 4 FIX: Broadcast cache invalidation to all replicas
    await this.redisPubSub.publishMessage('cache:invalidate:messages', {
      conversationId: message.conversationId,
    })

    // PHASE 6: Broadcast reaction via Redis pub/sub for real-time updates
    await this.redisPubSub.publishMessage('reactions:added', {
      messageId,
      conversationId: message.conversationId,
      reaction: {
        id: reaction.id,
        emoji: reaction.emoji,
        userId: reaction.userId,
        createdAt: reaction.createdAt.toISOString(),
      },
      senderId: message.senderId,
    })

    this.logger.debug(`Reaction added: ${emoji} to message: ${messageId} by user: ${userId}`)
    return reaction
  }

  /**
   * Remove reaction from message
   * PHASE 6: Enhanced with Redis pub/sub for real-time updates
   */
  async removeReaction(dto: RemoveReactionDto) {
    const { messageId, userId, emoji } = dto

    // Get message details for broadcasting
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true, senderId: true },
    })

    if (!message) {
      throw new NotFoundException('Message not found')
    }

    // Delete reaction
    await this.prisma.messageReaction.delete({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
    })

    // ✅ PHASE 4 FIX: Invalidate message cache
    await this.redis.del(`message:${messageId}`)
    await this.invalidateMessageCache(message.conversationId)

    // ✅ PHASE 4 FIX: Broadcast cache invalidation
    await this.redisPubSub.publishMessage('cache:invalidate:messages', {
      conversationId: message.conversationId,
    })

    // PHASE 6: Broadcast reaction removal via Redis pub/sub
    await this.redisPubSub.publishMessage('reactions:removed', {
      messageId,
      conversationId: message.conversationId,
      emoji,
      userId,
      senderId: message.senderId,
      removedAt: new Date().toISOString(),
    })

    this.logger.debug(`Reaction removed: ${emoji} from message: ${messageId} by user: ${userId}`)
    return { success: true }
  }

  /**
   * Bookmark a message
   * PHASE 6: Enhanced with optional note field
   */
  async bookmarkMessage(dto: BookmarkMessageDto) {
    const { messageId, userId, note } = dto

    // Verify message exists
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    })

    if (!message) {
      throw new NotFoundException('Message not found')
    }

    // Create bookmark with optional note
    const bookmark = await this.prisma.messageBookmark.create({
      data: {
        messageId,
        userId,
        note,
      },
      include: {
        message: {
          select: {
            id: true,
            content: true,
            conversationId: true,
            senderId: true,
            createdAt: true,
          },
        },
      },
    })

    // ✅ PHASE 5 FIX: Invalidate bookmark list cache
    const cacheKey = `bookmarks:${userId}:*`
    await this.deleteKeysByPattern(cacheKey)

    // ✅ PHASE 5 FIX: Broadcast bookmark event to all devices
    await this.redisPubSub.publishMessage('bookmarks:added', {
      messageId,
      userId,
      bookmarkId: bookmark.id,
      note,
    })

    this.logger.debug(`Message ${messageId} bookmarked by user ${userId}`)
    return bookmark
  }

  /**
   * Remove bookmark from message
   */
  async unbookmarkMessage(dto: UnbookmarkMessageDto) {
    const { messageId, userId } = dto

    // Get bookmark ID before deletion for broadcast
    const bookmark = await this.prisma.messageBookmark.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
      select: { id: true },
    })

    await this.prisma.messageBookmark.delete({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
    })

    // ✅ PHASE 5 FIX: Invalidate bookmark list cache
    const cacheKey = `bookmarks:${userId}:*`
    await this.deleteKeysByPattern(cacheKey)

    // ✅ PHASE 5 FIX: Broadcast bookmark event
    await this.redisPubSub.publishMessage('bookmarks:removed', {
      bookmarkId: bookmark?.id,
      messageId,
      userId,
    })

    this.logger.debug(`Bookmark removed from message ${messageId} by user ${userId}`)
    return { success: true }
  }

  /**
   * PHASE 6: Get bookmarked messages for a user
   */
  async getBookmarkedMessages(userId: string, limit = 50, cursor?: string) {
    const where: any = {
      userId,
    }

    // Cursor-based pagination
    if (cursor) {
      const cursorBookmark = await this.prisma.messageBookmark.findUnique({
        where: { id: cursor },
        select: { createdAt: true, id: true },
      })

      if (cursorBookmark) {
        where.OR = [
          {
            createdAt: { lt: cursorBookmark.createdAt },
          },
          {
            createdAt: cursorBookmark.createdAt,
            id: { lt: cursor },
          },
        ]
      }
    }

    const bookmarks = await this.prisma.messageBookmark.findMany({
      where,
      include: {
        message: {
          include: {
            sender: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            conversation: {
              select: { id: true, type: true },
            },
            reactions: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })

    return bookmarks
  }

  /**
   * Pin a message in conversation
   * PHASE 6: Enhanced with pin limit validation and Redis pub/sub
   */
  async pinMessage(dto: PinMessageDto) {
    const { messageId, userId } = dto

    // Get message details
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true, isPinned: true },
    })

    if (!message) {
      throw new NotFoundException('Message not found')
    }

    if (message.isPinned) {
      throw new BadRequestException('Message is already pinned')
    }

    // Check pin limit (max 5 pinned messages per conversation)
    const pinnedCount = await this.prisma.message.count({
      where: {
        conversationId: message.conversationId,
        isPinned: true,
      },
    })

    if (pinnedCount >= 5) {
      throw new BadRequestException('Maximum 5 messages can be pinned per conversation')
    }

    // Pin the message
    const updatedMessage = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isPinned: true,
        pinnedAt: new Date(),
        pinnedBy: userId,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    })

    // ✅ PHASE 4 FIX: Invalidate message cache (pin status changed)
    await this.redis.del(`message:${messageId}`)
    await this.invalidateMessageCache(message.conversationId)

    // ✅ PHASE 4 FIX: Invalidate pinned messages cache
    const pinnedCacheKey = `messages:pinned:${message.conversationId}`
    await this.redis.del(pinnedCacheKey)

    // ✅ PHASE 4 FIX: Broadcast cache invalidation to all replicas
    await this.redisPubSub.publishMessage('cache:invalidate:messages', {
      conversationId: message.conversationId,
    })

    // PHASE 6: Broadcast pin event via Redis pub/sub
    await this.redisPubSub.publishMessage('messages:pinned', {
      messageId,
      conversationId: message.conversationId,
      pinnedBy: userId,
      pinnedAt: updatedMessage.pinnedAt?.toISOString(),
    })

    this.logger.debug(`Message ${messageId} pinned by user ${userId}`)
    return updatedMessage
  }

  /**
   * Unpin a message
   * PHASE 6: Enhanced with Redis pub/sub
   */
  async unpinMessage(dto: UnpinMessageDto) {
    const { messageId } = dto

    // Get message details
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true, isPinned: true, pinnedBy: true },
    })

    if (!message) {
      throw new NotFoundException('Message not found')
    }

    if (!message.isPinned) {
      throw new BadRequestException('Message is not pinned')
    }

    // Unpin the message
    const updatedMessage = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isPinned: false,
        pinnedAt: null,
        pinnedBy: null,
      },
    })

    // ✅ PHASE 4 FIX: Invalidate message cache
    await this.redis.del(`message:${messageId}`)
    await this.invalidateMessageCache(message.conversationId)

    // ✅ PHASE 4 FIX: Invalidate pinned messages cache
    const pinnedCacheKey = `messages:pinned:${message.conversationId}`
    await this.redis.del(pinnedCacheKey)

    // ✅ PHASE 4 FIX: Broadcast cache invalidation
    await this.redisPubSub.publishMessage('cache:invalidate:messages', {
      conversationId: message.conversationId,
    })

    // PHASE 6: Broadcast unpin event via Redis pub/sub
    await this.redisPubSub.publishMessage('messages:unpinned', {
      messageId,
      conversationId: message.conversationId,
      unpinnedBy: message.pinnedBy,
      unpinnedAt: new Date().toISOString(),
    })

    this.logger.debug(`Message ${messageId} unpinned`)
    return updatedMessage
  }

  /**
   * Forward a message to another conversation
   * PHASE 6: Enhanced with forwardCount tracking and Redis pub/sub
   */
  async forwardMessage(dto: ForwardMessageDto) {
    const { messageId, toConversationId, forwardedBy } = dto

    const originalMessage = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        content: true,
        contentType: true,
        senderId: true,
        forwardCount: true,
      },
    })

    if (!originalMessage) {
      throw new NotFoundException('Original message not found')
    }

    // Use transaction to create forwarded message and update original message atomically
    const result = await this.prisma.$transaction(async tx => {
      // Create forwarded message
      const forwardedMessage = await tx.message.create({
        data: {
          conversationId: toConversationId,
          senderId: forwardedBy,
          senderType: SenderType.USER,
          content: originalMessage.content,
          contentType: originalMessage.contentType,
          forwardedFromId: messageId,
          status: MessageStatus.SENT,
          sentAt: new Date(),
        },
        include: {
          sender: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      })

      // Increment forward count on original message
      await tx.message.update({
        where: { id: messageId },
        data: {
          forwardCount: { increment: 1 },
        },
      })

      // Update conversation metrics
      await tx.conversation.update({
        where: { id: toConversationId },
        data: {
          lastMessageId: forwardedMessage.id,
          updatedAt: new Date(),
          lastActivityAt: new Date(),
          messageCount: { increment: 1 },
        },
      })

      return forwardedMessage
    })

    // PHASE 6: Broadcast forwarded message via Redis pub/sub for real-time delivery
    // ✅ Fetch target conversation participants for user-room broadcasting
    const targetConversation = await this.prisma.conversation.findUnique({
      where: { id: toConversationId },
      select: {
        type: true,
        metadata: true,
        participants: { select: { userId: true } },
      },
    })
    const forwardRecipientUserIds = (targetConversation?.participants ?? [])
      .map(p => p.userId)
      .filter(id => id !== forwardedBy)
    const forwardMetadata = targetConversation?.metadata as { providerId?: string } | null

    const publishedAt = new Date()
    await this.redisPubSub.publishMessage('messages:new', {
      messageId: result.id,
      conversationId: toConversationId,
      senderId: forwardedBy,
      content: result.content,
      contentType: result.contentType,
      forwardedFromId: messageId,
      originalSenderId: originalMessage.senderId,
      sentAt: result.sentAt.toISOString(),
      // ✅ Include recipient info so Redis subscriber can broadcast to user rooms
      recipientUserIds: forwardRecipientUserIds,
      providerId: forwardMetadata?.providerId,
      publishedAt: publishedAt.toISOString(),
      latencyMs: Date.now() - publishedAt.getTime(),
    })

    this.logger.log(
      `Message forwarded: ${messageId} to conversation: ${toConversationId} (forward count: ${originalMessage.forwardCount + 1})`
    )
    return result
  }

  /**
   * PHASE 6.7: Get edit history for a message
   * Retrieves all edit history records with cursor-based pagination
   */
  async getMessageEditHistory(messageId: string, limit = 50, cursor?: string) {
    // Verify message exists
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true },
    })

    if (!message) {
      throw new NotFoundException('Message not found')
    }

    const where: any = {
      messageId,
    }

    // Cursor-based pagination
    if (cursor) {
      const cursorHistory = await this.prisma.messageEditHistory.findUnique({
        where: { id: cursor },
        select: { editedAt: true, id: true },
      })

      if (cursorHistory) {
        where.OR = [
          {
            editedAt: { lt: cursorHistory.editedAt },
          },
          {
            editedAt: cursorHistory.editedAt,
            id: { lt: cursor },
          },
        ]
      }
    }

    const editHistory = await this.prisma.messageEditHistory.findMany({
      where,
      include: {
        editor: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: [{ editedAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })

    this.logger.debug(
      `Retrieved ${editHistory.length} edit history records for message ${messageId}`
    )
    return editHistory
  }

  /**
   * PHASE 6.9: Schedule a message for later
   * Enhanced with proper status tracking
   */
  async scheduleMessage(dto: ScheduleMessageDto) {
    const { conversationId, senderId, content, scheduledFor, scheduledBy } = dto

    if (scheduledFor <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future')
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        senderType: SenderType.USER,
        content,
        contentType: ContentType.TEXT,
        isScheduled: true,
        scheduledFor,
        scheduledBy,
        status: MessageStatus.SENDING, // PHASE 6.9: Use SENDING status for scheduled messages
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        conversation: {
          select: { id: true, type: true },
        },
      },
    })

    this.logger.log(`Message scheduled: ${message.id} for ${scheduledFor}`)
    return message
  }

  /**
   * PHASE 6.9: Get scheduled messages for a user
   * Retrieves all pending scheduled messages
   */
  async getScheduledMessages(userId: string, limit = 50, cursor?: string) {
    const where: any = {
      senderId: userId,
      isScheduled: true,
      status: MessageStatus.SENDING, // Scheduled messages use SENDING status
      scheduledFor: {
        gt: new Date(), // Only future scheduled messages
      },
    }

    // Cursor-based pagination
    if (cursor) {
      const cursorMessage = await this.prisma.message.findUnique({
        where: { id: cursor },
        select: { scheduledFor: true, id: true },
      })

      if (cursorMessage?.scheduledFor) {
        where.OR = [
          {
            scheduledFor: { gt: cursorMessage.scheduledFor },
          },
          {
            scheduledFor: cursorMessage.scheduledFor,
            id: { gt: cursor },
          },
        ]
      }
    }

    const scheduledMessages = await this.prisma.message.findMany({
      where,
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        conversation: {
          select: { id: true, type: true },
        },
      },
      orderBy: [{ scheduledFor: 'asc' }, { id: 'asc' }],
      take: limit,
    })

    this.logger.debug(`Retrieved ${scheduledMessages.length} scheduled messages for user ${userId}`)
    return scheduledMessages
  }

  /**
   * PHASE 6.9: Cancel a scheduled message
   * Prevents a scheduled message from being sent
   */
  async cancelScheduledMessage(messageId: string, userId: string) {
    // Get the scheduled message
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        senderId: true,
        isScheduled: true,
        status: true,
        scheduledFor: true,
      },
    })

    if (!message) {
      throw new NotFoundException('Scheduled message not found')
    }

    if (message.senderId !== userId) {
      throw new BadRequestException('You can only cancel your own scheduled messages')
    }

    if (!message.isScheduled || message.status !== MessageStatus.SENDING) {
      throw new BadRequestException('Message is not scheduled or has already been sent')
    }

    if (message.scheduledFor && message.scheduledFor <= new Date()) {
      throw new BadRequestException(
        'Cannot cancel a scheduled message that is already being processed'
      )
    }

    // Delete the scheduled message
    await this.prisma.message.delete({
      where: { id: messageId },
    })

    this.logger.log(`Scheduled message ${messageId} cancelled by user ${userId}`)
    return { success: true, message: 'Scheduled message cancelled successfully' }
  }

  /**
   * Report a message for abuse
   */
  async reportMessage(dto: ReportMessageDto) {
    const { messageId, reportedBy, reason, description } = dto

    const report = await this.prisma.messageReport.create({
      data: {
        messageId,
        reportedBy,
        reason,
        description,
      },
    })

    this.logger.warn(`Message reported: ${messageId} by user: ${reportedBy} for ${reason}`)
    return report
  }

  /**
   * PHASE 6: Get messages where user was mentioned
   */
  async getMentionedMessages(userId: string, limit = 50, cursor?: string) {
    const where: any = {
      mentions: {
        some: {
          userId,
        },
      },
      isDeleted: false,
    }

    // Cursor-based pagination
    if (cursor) {
      const cursorMessage = await this.prisma.message.findUnique({
        where: { id: cursor },
        select: { createdAt: true, id: true },
      })

      if (cursorMessage) {
        where.OR = [
          {
            createdAt: { lt: cursorMessage.createdAt },
          },
          {
            createdAt: cursorMessage.createdAt,
            id: { lt: cursor },
          },
        ]
      }
    }

    const messages = await this.prisma.message.findMany({
      where,
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        conversation: {
          select: { id: true, type: true },
        },
        mentions: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        reactions: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })

    return messages
  }

  /**
   * PHASE 6: Get message thread/reply chain
   * Fetches the full thread starting from a message
   */
  async getMessageThread(messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        replyTo: {
          include: {
            sender: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        reactions: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    })

    if (!message) {
      throw new NotFoundException('Message not found')
    }

    // Build reply chain by following replyTo relationships
    const thread: any[] = [message]
    let currentMessage = message

    // Follow the chain backwards to find the root message
    while (currentMessage.replyTo) {
      thread.unshift(currentMessage.replyTo)
      currentMessage = currentMessage.replyTo as any
    }

    return {
      rootMessage: thread[0],
      thread,
      threadLength: thread.length,
    }
  }

  /**
   * Helper: Parse mentions from message content
   */
  private parseMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g
    const mentions: string[] = []
    let match

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1])
    }

    return mentions
  }

  /**
   * ✅ NEW: Invalidate message cache for a conversation
   * Deletes all cached message pages (all limit/cursor/direction combinations)
   * ✅ PUBLIC: Called from RedisPubSubService for cross-replica cache invalidation
   */
  async invalidateMessageCache(conversationId: string): Promise<void> {
    const pattern = `messages:${conversationId}:*`
    await this.deleteKeysByPattern(pattern)

    this.logger.debug(`Invalidated message cache for conversation ${conversationId}`)
  }

  /**
   * ✅ NEW: Delete cache keys by pattern using SCAN (non-blocking)
   * Replaces KEYS command which blocks Redis in production
   */
  private async deleteKeysByPattern(pattern: string): Promise<void> {
    const client = this.redis.getClient()
    let cursor = '0'
    const keysToDelete: string[] = []

    // Use SCAN to iterate through keys matching the pattern
    // SCAN is non-blocking and safe for production use
    do {
      const [newCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = newCursor
      keysToDelete.push(...keys)
    } while (cursor !== '0')

    // Delete all matching keys in one operation
    if (keysToDelete.length > 0) {
      await client.del(...keysToDelete)
      this.logger.debug(`Deleted ${keysToDelete.length} cache keys matching ${pattern}`)
    }
  }
}
