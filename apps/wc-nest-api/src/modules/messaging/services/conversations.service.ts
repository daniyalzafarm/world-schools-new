import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { NotificationType } from '@world-schools/wc-types'
import { PrismaService } from '../../../prisma/prisma.service'
import { RedisService } from '../../redis/redis.service'
import { RedisPubSubService } from './redis-pub-sub.service'
import { ConfigService } from '../../../config/config.service'
import { notify } from '../../notifications/dispatcher/notify'
import { AzureStorageService } from '@world-schools/wc-utils/backend'
import {
  ContextType,
  ConversationStatus,
  ConversationType,
  SenderType,
} from '../../../generated/client/client'
import {
  AddLabelDto,
  AssignConversationDto,
  ConversationMetrics,
  CreateConversationDto,
  GetConversationsDto,
  RemoveLabelDto,
  UpdateConversationSettingsDto,
  UpdateConversationStatusDto,
} from '../interfaces/conversation.interface'

/**
 * Stable uniqueness key for a USER_PROVIDER conversation: one thread per
 * (parent user, provider, camp context). Persisted to `Conversation.dedupeKey`
 * (unique index) so duplicate threads are rejected at the DB level, and used by
 * the migration backfill so existing rows produce identical keys.
 */
export function buildProviderConversationKey(
  userId: string,
  providerId: string,
  contextType?: ContextType | null,
  contextId?: string | null
): string {
  return `${userId}:${providerId}:${contextType ?? ContextType.GENERAL}:${contextId ?? ''}`
}

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name)
  private readonly CACHE_TTL = 300 // 5 minutes
  private readonly recentCacheInvalidations = new Map<string, number>()
  private readonly CACHE_INVALIDATION_DEBOUNCE_MS = 1000
  private azureStorage: AzureStorageService | null = null

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private redisPubSub: RedisPubSubService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2
  ) {}

  /**
   * Create a new conversation or return existing one
   *
   * IMPORTANT: For USER_PROVIDER conversations:
   * - Only the user participant is created
   * - Provider organization is referenced via contextId (when contextType is CAMP/BOOKING)
   * - NO provider user participant is created initially
   * - Provider users see conversations through organization membership
   * - Conversation starts UNASSIGNED (assignedToId = null)
   * - Auto-assignment happens on first provider reply (handled in messages service)
   *
   * IMPORTANT: Initial message is REQUIRED
   * - Conversations are only created when the user sends the first message
   * - This prevents empty conversations from cluttering the conversation list
   * - Follows industry best practices (WhatsApp, Slack, Discord)
   */
  async createConversation(dto: CreateConversationDto) {
    const { userId, participantId, participantType, contextType, contextId, initialMessage } = dto

    // Require initial message
    if (!initialMessage || initialMessage.trim().length === 0) {
      throw new BadRequestException('Initial message is required to create a conversation')
    }

    // Determine conversation type
    const type =
      participantType === 'provider'
        ? ConversationType.USER_PROVIDER
        : ConversationType.USER_SUPERADMIN

    // Check if conversation already exists.
    // For provider conversations the uniqueness key includes the camp context
    // (contextType/contextId), so a parent gets a separate thread per camp even
    // when several camps belong to the same provider.
    const existing = await this.findExistingConversation(
      userId,
      participantId,
      participantType,
      contextType,
      contextId
    )

    if (existing) {
      this.logger.log(`Found existing conversation: ${existing.id}`)
      return existing
    }

    // For provider conversations, verify the provider exists
    if (participantType === 'provider') {
      const provider = await this.prisma.provider.findUnique({
        where: { id: participantId },
        select: { id: true },
      })

      if (!provider) {
        throw new NotFoundException(`Provider with ID ${participantId} not found`)
      }
    }

    // Stable per-(parent, provider, camp) key persisted with a unique index so
    // the DB rejects accidental duplicate threads even under a race.
    const dedupeKey =
      participantType === 'provider'
        ? buildProviderConversationKey(userId, participantId, contextType, contextId)
        : null

    // Create new conversation
    // For USER_PROVIDER: Only create user participant, provider sees via organization
    // For USER_SUPERADMIN: Create both user and superadmin participants
    this.logger.log(`Creating new conversation: ${type}`)
    const conversation = await this.prisma.conversation.create({
      data: {
        type,
        status: ConversationStatus.OPEN,
        contextType: contextType || ContextType.GENERAL,
        contextId,
        dedupeKey,
        // Store provider ID in metadata for provider conversations
        // This allows provider users to find conversations for their organization
        metadata:
          participantType === 'provider'
            ? {
                providerId: participantId,
              }
            : undefined,
        // Assignment fields - start unassigned for provider conversations
        assignedToId: null,
        assignedAt: null,
        assignedBy: null,
        participants: {
          create:
            participantType === 'provider'
              ? [
                  // Only create user participant
                  // Provider users see this conversation through their organization
                  { userId },
                ]
              : [
                  // For superadmin conversations, create both participants
                  { userId },
                  { userId: participantId },
                ],
        },
        ...(initialMessage && {
          messages: {
            create: {
              senderId: userId,
              senderType: SenderType.USER,
              content: initialMessage,
              contentType: 'TEXT',
              status: 'SENT',
              sentAt: new Date(),
            },
          },
        }),
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                profilePhotoUrl: true,
              },
            },
            provider: { select: { id: true, legalCompanyName: true, email: true } },
          },
        },
        lastMessage: true,
      },
    })

    // Update lastMessageId for the initial message (inline create bypasses sendMessage())
    let initialMessageId: string | undefined
    if (initialMessage) {
      const initialMsg = await this.prisma.message.findFirst({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
      if (initialMsg) {
        initialMessageId = initialMsg.id
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          // Bump lastActivityAt like sendMessage() does, so the conversation
          // sorts by its first message (lastActivityAt is the recency field).
          data: { lastMessageId: initialMsg.id, lastActivityAt: new Date() },
        })
      }
    }

    // Collect all users whose cache needs invalidation
    const userIdsToInvalidate: string[] = [userId]

    // Add other participant for USER_SUPERADMIN conversations
    if (participantType !== 'provider') {
      userIdsToInvalidate.push(participantId)
    }

    // Invalidate cache for all affected users
    for (const userIdToInvalidate of userIdsToInvalidate) {
      await this.invalidateConversationCache(userIdToInvalidate)
    }

    // For provider conversations, invalidate provider users' cache
    if (participantType === 'provider') {
      // Local invalidation for provider users on current replica
      const providerUsers = await this.redisPubSub.getProviderUsers(participantId)
      for (const providerUser of providerUsers) {
        await this.invalidateConversationCache(providerUser.id)
      }

      // Broadcast to all replicas to invalidate provider users' cache
      await this.redisPubSub.publishMessage('cache:invalidate:conversations', {
        userIds: userIdsToInvalidate,
        providerId: participantId, // participantId is the provider ID
      })

      // Emit WebSocket event to provider users for real-time conversation list updates
      this.logger.log(
        `[Real-time] Publishing conversations:new event for provider ${participantId}`
      )
      await this.redisPubSub.publishMessage('conversations:new', {
        conversation,
        providerId: participantId,
      })
      this.logger.log(
        `[Real-time] Published conversations:new event for conversation ${conversation.id}`
      )

      // Notify the provider side about the parent's first message. The inline
      // initial message bypasses MessagesService.sendMessage(), which is where
      // the per-message notification normally fires — so dispatch it here. The
      // conversation is unclaimed (assignedToId = null), so the
      // providerMessagingRecipients resolver fans out to every provider user
      // who holds the Messaging permission.
      if (contextType !== ContextType.SUPPORT_TICKET && initialMessageId) {
        notify(this.eventEmitter, NotificationType.ProviderMessagingNewFromFamily, {
          conversationId: conversation.id,
          messageId: initialMessageId,
          providerId: participantId,
        })
      }
    } else {
      // Broadcast to all replicas to invalidate participants' cache
      await this.redisPubSub.publishMessage('cache:invalidate:conversations', {
        userIds: userIdsToInvalidate,
      })

      // Emit WebSocket event to superadmin users for real-time conversation list updates
      await this.redisPubSub.publishMessage('conversations:new', {
        conversation,
        userIds: userIdsToInvalidate,
      })
    }

    this.logger.debug(
      `Cache invalidated for new conversation ${conversation.id} and ${userIdsToInvalidate.length} users`
    )

    // Enrich conversation with provider data for USER_PROVIDER conversations
    // This matches the enrichment done in getConversations() to ensure consistent data structure
    let enrichedConversation = conversation
    if (participantType === 'provider') {
      const metadata = conversation.metadata as { providerId?: string } | null
      if (metadata?.providerId) {
        const provider = await this.prisma.provider.findUnique({
          where: { id: metadata.providerId },
          select: { id: true, legalCompanyName: true, email: true },
        })

        if (provider) {
          // Add provider to participants array for frontend compatibility
          enrichedConversation = {
            ...conversation,
            participants: [
              ...conversation.participants,
              {
                id: `provider-${provider.id}`, // Synthetic ID for frontend
                conversationId: conversation.id,
                userId: null,
                providerId: provider.id,
                provider,
                user: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              } as any,
            ],
          }
        }
      }
    }

    // Attach camp identity (name/location/photo) so the new conversation shows
    // the camp — not the operator org — immediately after creation and on the
    // post-send re-fetch (prevents the header flipping to the provider name).
    const campContext = (await this.buildCampContextMap([conversation])).get(conversation.id)
    if (campContext) {
      enrichedConversation = { ...enrichedConversation, ...campContext }
    }

    return enrichedConversation
  }

  /**
   * Build where clause for conversation queries
   *
   * IMPORTANT: This method supports both regular users and provider users:
   * - Regular users: Find conversations where they are a participant (userId match)
   * - Provider users: Find conversations where they are a participant OR where their provider organization is referenced in metadata.providerId
   *
   * The providerId parameter should be passed when querying for provider users.
   */
  private buildConversationWhereClause(dto: GetConversationsDto & { providerId?: string }) {
    const { userId, filter = 'all', providerId, excludeSupportTicketContext } = dto

    // Base condition: Find conversations where user is a participant
    const participantCondition: any = {
      userId,
      ...(filter === 'archived' && { archived: true }),
      ...(filter === 'starred' && { starred: true }),
      // Unread = real unread messages OR a manual "mark as unread".
      ...(filter === 'unread' && { OR: [{ unreadCount: { gt: 0 } }, { manuallyUnread: true }] }),
    }

    if (filter !== 'archived') {
      participantCondition.archived = false
    }

    // If providerId is provided, also include conversations for the provider organization
    if (providerId) {
      // Provider users can see:
      // 1. Conversations where they are a participant (e.g., direct messages)
      // 2. Conversations where their provider organization is referenced in metadata.providerId
      const where: any = {
        OR: [
          // Condition 1: User is a participant
          {
            participants: {
              some: participantCondition,
            },
          },
          // Condition 2: Provider organization is referenced in metadata
          {
            type: ConversationType.USER_PROVIDER,
            metadata: {
              path: ['providerId'],
              equals: providerId,
            },
          },
        ],
      }

      if (excludeSupportTicketContext) {
        where.AND = [
          ...(where.AND ?? []),
          {
            NOT: {
              contextType: ContextType.SUPPORT_TICKET,
            },
          },
        ]
      }

      return where
    }

    // Regular users: Only find conversations where they are a participant
    const where: any = {
      participants: {
        some: participantCondition,
      },
    }

    if (excludeSupportTicketContext) {
      where.AND = [
        ...(where.AND ?? []),
        {
          NOT: {
            contextType: ContextType.SUPPORT_TICKET,
          },
        },
      ]
    }

    return where
  }

  /**
   * Get total count of conversations for a user with filters
   */
  async getConversationsCount(dto: GetConversationsDto): Promise<number> {
    const { userId, filter = 'all', excludeSupportTicketContext } = dto

    // Check if user is a provider user and get their provider ID
    const providerId = await this.getProviderIdForUser(userId!)

    // Try to get from cache
    const cacheKey = `conversations:count:${userId}:${filter}:${providerId || 'none'}:${
      excludeSupportTicketContext ? 'no-support' : 'all-contexts'
    }`
    const cached = await this.redis.get(cacheKey)
    if (cached) {
      this.logger.debug(`Cache hit for conversations count: ${cacheKey}`)
      return parseInt(cached, 10)
    }

    const where = await this.buildConversationWhereClause({
      ...dto,
      providerId: providerId || undefined,
    })

    const count = await this.prisma.conversation.count({ where })

    // Cache the result for 5 minutes
    await this.redis.setex(cacheKey, 300, count.toString())

    return count
  }

  /**
   * Resolve camp identity (name / location / primary photo) for the given
   * conversations whose context points at a camp — either directly
   * (contextType CAMP, contextId = camp id) or via a booking
   * (contextType BOOKING, contextId = booking id → booking.campId).
   *
   * Returns a map keyed by conversationId. Batched to avoid N+1 queries,
   * mirroring the provider enrichment in getConversations(). Used so the UI
   * can show the camp (name/photo/location) rather than the operator org.
   */
  private async buildCampContextMap(
    conversations: {
      id: string
      type: ConversationType
      contextType: ContextType | null
      contextId: string | null
    }[]
  ): Promise<
    Map<string, { campName: string; campLocation: string | null; campPhotoUrl: string | null }>
  > {
    const result = new Map<
      string,
      { campName: string; campLocation: string | null; campPhotoUrl: string | null }
    >()

    const directCampIds = new Set<string>()
    const bookingIds = new Set<string>()
    for (const conv of conversations) {
      if (conv.type !== ConversationType.USER_PROVIDER || !conv.contextId) continue
      if (conv.contextType === ContextType.CAMP) directCampIds.add(conv.contextId)
      else if (conv.contextType === ContextType.BOOKING) bookingIds.add(conv.contextId)
    }

    if (directCampIds.size === 0 && bookingIds.size === 0) return result

    // Resolve booking-context conversations to their camp
    const bookingToCampId = new Map<string, string>()
    if (bookingIds.size > 0) {
      const bookings = await this.prisma.booking.findMany({
        where: { id: { in: Array.from(bookingIds) } },
        select: { id: true, campId: true },
      })
      for (const booking of bookings) {
        bookingToCampId.set(booking.id, booking.campId)
        directCampIds.add(booking.campId)
      }
    }

    // Batch-load all camps in one query
    const camps = await this.prisma.camp.findMany({
      where: { id: { in: Array.from(directCampIds) } },
      select: { id: true, name: true, locationName: true, photos: true },
    })

    // Resolve each unique camp's identity once, signing the primary photo to a
    // viewable SAS URL (camp photos are Azure blobs; the raw stored path won't
    // render). SAS signing is a local crypto op, so per-camp is cheap.
    const campIdentityById = new Map<
      string,
      { campName: string; campLocation: string | null; campPhotoUrl: string | null }
    >()
    await Promise.all(
      camps.map(async camp => {
        campIdentityById.set(camp.id, {
          campName: camp.name,
          campLocation: camp.locationName ?? null,
          campPhotoUrl: await this.resolveCampPhotoUrl(camp.photos),
        })
      })
    )

    for (const conv of conversations) {
      if (conv.type !== ConversationType.USER_PROVIDER || !conv.contextId) continue
      const campId =
        conv.contextType === ContextType.CAMP
          ? conv.contextId
          : conv.contextType === ContextType.BOOKING
            ? bookingToCampId.get(conv.contextId)
            : undefined
      if (!campId) continue
      const identity = campIdentityById.get(campId)
      if (!identity) continue

      result.set(conv.id, identity)
    }

    return result
  }

  /**
   * Resolve a camp's primary photo to a viewable URL. Camp photos are stored as
   * Azure blob paths (or absolute URLs); blob paths must be signed with a SAS
   * token to be displayable. Mirrors BookingGroupsService.resolveCampCoverImageUrl
   * so the messaging avatar matches camp imagery elsewhere on the platform.
   */
  private async resolveCampPhotoUrl(photos: unknown): Promise<string | null> {
    if (!Array.isArray(photos) || photos.length === 0) return null
    const list = photos as Array<{ url?: string; isPrimary?: boolean }>
    const withUrl = list.filter(photo => photo?.url)
    if (withUrl.length === 0) return null

    const chosen = withUrl.find(photo => photo.isPrimary) ?? withUrl[0]
    const raw = String(chosen.url).trim()
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw
    }

    try {
      return await this.getAzureStorage().generateSasUrl(raw, 24)
    } catch (err) {
      this.logger.warn(
        `Failed to sign camp photo URL: ${err instanceof Error ? err.message : String(err)}`
      )
      return null
    }
  }

  /**
   * Resolve each participant's stored profile-photo blob path to a usable SAS
   * URL (mutates in place). Lets the conversation list + chat header show the
   * other party's real avatar instead of initials. Blob paths are deduped within
   * the call so a repeated photo is signed once.
   */
  private async enrichParticipantPhotos(
    conversations: Array<{
      participants?: Array<{ user?: { profilePhotoUrl?: string | null } | null }>
    }>
  ): Promise<void> {
    const cache = new Map<string, string | null>()
    const resolve = async (raw: string): Promise<string | null> => {
      if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
      if (cache.has(raw)) return cache.get(raw) ?? null
      let url: string | null = null
      try {
        url = await this.getAzureStorage().generateSasUrl(raw, 24)
      } catch (err) {
        this.logger.warn(
          `Failed to sign profile photo URL: ${err instanceof Error ? err.message : String(err)}`
        )
      }
      cache.set(raw, url)
      return url
    }

    for (const conv of conversations) {
      for (const participant of conv.participants ?? []) {
        const raw = participant.user?.profilePhotoUrl
        if (participant.user && raw) {
          participant.user.profilePhotoUrl = await resolve(raw)
        }
      }
    }
  }

  /**
   * Lazily construct the Azure storage client (same pattern as AttachmentsService
   * and BookingGroupsService).
   */
  private getAzureStorage(): AzureStorageService {
    if (!this.azureStorage) {
      const config = this.configService.azureStorageConfig
      if (!config.accountName || !config.accountKey || !config.containerName) {
        throw new Error('Azure Storage is not configured. Please contact the administrator.')
      }
      this.azureStorage = new AzureStorageService(config)
    }
    return this.azureStorage
  }

  /**
   * Compute per-conversation unread counts for a provider user from message read
   * receipts. Provider users have no ConversationParticipant row, so their unread
   * can't live on participant.unreadCount; instead count messages not sent by them
   * and not yet read by them — the same definition markAllAsRead clears. Returns an
   * empty map when userId is null (non-provider viewer) or there are no
   * conversations. Single grouped query (no N+1).
   */
  private async buildProviderUnreadMap(
    userId: string | null,
    conversationIds: string[]
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>()
    if (!userId || conversationIds.length === 0) return result

    const grouped = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: userId },
        readReceipts: { none: { userId } },
      },
      _count: { _all: true },
    })

    for (const row of grouped) {
      result.set(row.conversationId, row._count._all)
    }
    return result
  }

  /**
   * Get conversations for a user with filters
   */
  async getConversations(dto: GetConversationsDto) {
    const { userId, filter = 'all', limit = 50, offset = 0, excludeSupportTicketContext } = dto

    // Check if user is a provider user and get their provider ID
    const providerId = await this.getProviderIdForUser(userId!)

    // Try to get from cache
    const cacheKey = `conversations:${userId}:${filter}:${limit}:${offset}:${providerId || 'none'}:${
      excludeSupportTicketContext ? 'no-support' : 'all-contexts'
    }`
    const cached = await this.redis.get(cacheKey)
    if (cached) {
      // Track cache hit
      this.logger.log({
        event: 'cache.conversations.hit',
        filter,
        providerId: providerId ? 'true' : 'false',
        cacheKey,
      })
      this.logger.debug(`Cache hit for conversations: ${cacheKey}`)
      return JSON.parse(cached)
    }

    // Track cache miss
    this.logger.log({
      event: 'cache.conversations.miss',
      filter,
      providerId: providerId ? 'true' : 'false',
      cacheKey,
    })

    const where = await this.buildConversationWhereClause({
      ...dto,
      providerId: providerId || undefined,
    })

    const conversations = await this.prisma.conversation.findMany({
      where,
      include: {
        participants: {
          // Include ALL participants (frontend will filter out current user if needed)
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                profilePhotoUrl: true,
              },
            },
            provider: { select: { id: true, legalCompanyName: true, email: true } },
          },
        },
        lastMessage: {
          select: {
            id: true,
            content: true,
            contentType: true,
            senderId: true,
            senderType: true,
            createdAt: true,
          },
        },
        labels: {
          include: { label: true },
        },
      },
      // Order by last message/activity (not updatedAt — that bumps on any row
      // change like assignment/status). createdAt breaks ties deterministically.
      orderBy: [{ lastActivityAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    })

    // Resolve participant avatars (SAS URLs) so the sidebar shows real photos.
    await this.enrichParticipantPhotos(conversations)

    // Collect all unique provider IDs (avoid N+1 queries)
    const providerIds = new Set<string>()
    for (const conv of conversations) {
      const metadata = conv.metadata as { providerId?: string } | null
      if (conv.type === ConversationType.USER_PROVIDER && metadata?.providerId) {
        providerIds.add(metadata.providerId)
      }
    }

    // Batch load all providers in ONE query
    const providers = await this.prisma.provider.findMany({
      where: { id: { in: Array.from(providerIds) } },
      select: {
        id: true,
        legalCompanyName: true,
        email: true,
      },
    })

    // Create provider lookup map for O(1) access
    const providerMap = new Map(providers.map(p => [p.id, p]))

    // Resolve camp identity (name/location/photo) for camp-/booking-context conversations
    const campContextMap = await this.buildCampContextMap(conversations)

    // Provider users have no ConversationParticipant row, so their per-conversation
    // unread can't come from participant.unreadCount. Compute it from read receipts
    // (same definition markAllAsRead clears) in a single grouped query, then expose
    // it via the virtual provider participant below so the sidebar badge/dot work.
    const providerUnreadMap = await this.buildProviderUnreadMap(
      providerId ? userId! : null,
      conversations.map(c => c.id)
    )

    // Enrich conversations using the provider map (no additional queries)
    const enrichedConversations = conversations.map(conv => {
      const metadata = conv.metadata as { providerId?: string } | null
      const campContext = campContextMap.get(conv.id)

      if (conv.type === ConversationType.USER_PROVIDER && metadata?.providerId) {
        const provider = providerMap.get(metadata.providerId)

        if (provider) {
          // Create a virtual participant for the provider organization
          // This allows the frontend to display provider info consistently
          const virtualProviderParticipant = {
            id: `virtual-${metadata.providerId}`,
            conversationId: conv.id,
            // For a provider viewer, key this on the requesting provider user's id
            // so their own participant lookup (sidebar/store) resolves and the
            // computed unread count is shown. For a parent viewer (providerId null)
            // keep the provider org id, matching prior behaviour.
            userId: providerId ? userId! : metadata.providerId,
            providerId: metadata.providerId,
            pinned: false,
            pinnedAt: null,
            starred: false,
            muted: false,
            archived: false,
            archivedAt: null,
            lastReadAt: null,
            unreadCount: providerId ? (providerUnreadMap.get(conv.id) ?? 0) : 0,
            manuallyUnread: false,
            joinedAt: conv.createdAt,
            leftAt: null,
            isRateLimited: false,
            rateLimitExpiresAt: null,
            user: null, // No user for provider organization
            provider: provider,
          } as any // Type assertion needed for virtual participant

          return {
            ...conv,
            ...campContext,
            participants: [...conv.participants, virtualProviderParticipant],
          }
        }
      }
      return campContext ? { ...conv, ...campContext } : conv
    })

    // Cache the result
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(enrichedConversations))

    return enrichedConversations
  }

  /**
   * Get a single conversation by ID
   */
  async getConversationById(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                profilePhotoUrl: true,
              },
            },
            provider: { select: { id: true, legalCompanyName: true, email: true } },
          },
        },
        lastMessage: true,
        labels: {
          include: { label: true },
        },
      },
    })

    if (!conversation) {
      throw new NotFoundException('Conversation not found')
    }

    // Verify access: a direct participant, or — for USER_PROVIDER threads — any
    // member of the provider org. A parent-initiated thread has no provider
    // participant row until the provider first replies, so org-level access must
    // be honored here too, the same way ConversationAccessGuard and the messages
    // service already do.
    const isParticipant = conversation.participants.some(p => p.userId === userId)
    if (!isParticipant) {
      const providerMetadata = conversation.metadata as { providerId?: string } | null
      const userProviderId =
        conversation.type === ConversationType.USER_PROVIDER && providerMetadata?.providerId
          ? await this.getProviderIdForUser(userId)
          : null
      if (!userProviderId || userProviderId !== providerMetadata?.providerId) {
        throw new ForbiddenException('You are not a participant in this conversation')
      }
    }

    // Resolve participant avatars (SAS URLs) so the chat header shows real photos.
    await this.enrichParticipantPhotos([conversation])

    // Resolve camp identity (name/location/photo) for camp-/booking-context conversations
    const campContext = (await this.buildCampContextMap([conversation])).get(conversation.id)

    // Enrich with provider organization data if needed
    // Type guard for metadata
    const metadata = conversation.metadata as { providerId?: string } | null

    if (conversation.type === ConversationType.USER_PROVIDER && metadata?.providerId) {
      const providerId = metadata.providerId

      const provider = await this.prisma.provider.findUnique({
        where: { id: providerId },
        select: { id: true, legalCompanyName: true, email: true },
      })

      if (provider) {
        // Create virtual provider participant
        const virtualProviderParticipant = {
          id: `virtual-${providerId}`,
          conversationId: conversation.id,
          userId: providerId,
          providerId: providerId,
          pinned: false,
          pinnedAt: null,
          starred: false,
          muted: false,
          archived: false,
          archivedAt: null,
          lastReadAt: null,
          unreadCount: 0,
          manuallyUnread: false,
          joinedAt: conversation.createdAt,
          leftAt: null,
          isRateLimited: false,
          rateLimitExpiresAt: null,
          user: null,
          provider: provider,
        } as any // Type assertion needed for virtual participant

        return {
          ...conversation,
          ...campContext,
          participants: [...conversation.participants, virtualProviderParticipant],
        }
      }
    }

    return campContext ? { ...conversation, ...campContext } : conversation
  }

  /**
   * Update conversation settings for a participant
   */
  async updateConversationSettings(dto: UpdateConversationSettingsDto) {
    const { conversationId, userId, pinned, starred, muted, archived } = dto

    // Verify user is a participant
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    })

    if (!participant) {
      throw new ForbiddenException('You are not a participant in this conversation')
    }

    // Update participant settings
    const updated = await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        ...(pinned !== undefined && { pinned }),
        ...(starred !== undefined && { starred }),
        ...(muted !== undefined && { muted }),
        ...(archived !== undefined && { archived }),
      },
    })

    // Invalidate cache
    await this.invalidateConversationCache(userId)

    // Invalidate metrics cache
    await this.redis.del(`conversation:metrics:${conversationId}`)

    // Broadcast cache invalidation to all replicas
    await this.redisPubSub.publishMessage('cache:invalidate:conversations', {
      userIds: [userId],
    })

    await this.redisPubSub.publishMessage('cache:invalidate:metrics', {
      conversationId,
    })

    return updated
  }

  /**
   * Mark all messages in a conversation as read.
   * All three DB operations run inside a single transaction to prevent
   * unread count corruption if the process crashes between steps.
   */
  async markAllAsRead(conversationId: string, userId: string) {
    let markedCount = 0
    let changed = false

    await this.prisma.$transaction(async tx => {
      // Was the conversation manually marked unread? Opening it must clear that
      // even when there are no unread messages to read.
      const participant = await tx.conversationParticipant.findFirst({
        where: { conversationId, userId },
        select: { manuallyUnread: true },
      })
      const hadManualUnread = participant?.manuallyUnread ?? false

      // Find all messages the user hasn't read yet (excluding their own).
      const unreadMessages = await tx.message.findMany({
        where: {
          conversationId,
          senderId: { not: userId },
          readReceipts: { none: { userId } },
        },
        select: { id: true },
      })

      if (unreadMessages.length > 0) {
        // Create read receipts atomically.
        await tx.messageReadReceipt.createMany({
          data: unreadMessages.map(msg => ({ messageId: msg.id, userId })),
          skipDuplicates: true,
        })
        markedCount = unreadMessages.length
      }

      // Always reset the participant's unread counter AND clear the manual-unread
      // flag. updateMany (not update) so this never throws for users without a
      // participant row (e.g. provider-org users who view via their organization).
      await tx.conversationParticipant.updateMany({
        where: { conversationId, userId },
        data: { unreadCount: 0, manuallyUnread: false },
      })

      changed = markedCount > 0 || hadManualUnread
    })

    if (!changed) {
      return { markedAsRead: 0 }
    }

    // Invalidate cache outside the transaction — a cache miss is acceptable;
    // a failed cache invalidation must never roll back committed read receipts.
    try {
      await this.invalidateConversationCache(userId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.warn(`Cache invalidation failed after markAllAsRead: ${msg}`)
    }

    return { markedAsRead: markedCount }
  }

  /**
   * Mark a conversation as unread for a user (manual, WhatsApp-style). Sets the
   * per-user `manuallyUnread` flag so the conversation shows as unread even with
   * zero unread messages; cleared on open via markAllAsRead. No-ops for users
   * without a participant row (updateMany matches zero rows).
   */
  async markConversationUnread(conversationId: string, userId: string) {
    const { count } = await this.prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { manuallyUnread: true },
    })

    if (count > 0) {
      try {
        await this.invalidateConversationCache(userId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        this.logger.warn(`Cache invalidation failed after markConversationUnread: ${msg}`)
      }
    }

    return { manuallyUnread: count > 0 }
  }

  /**
   * Assign conversation to a support agent
   */
  async assignConversation(dto: AssignConversationDto) {
    const { conversationId, assignedToId, assignedBy } = dto

    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedToId,
        assignedBy,
        assignedAt: new Date(),
      },
      include: {
        participants: true,
      },
    })

    // Invalidate cache for all participants
    for (const participant of conversation.participants) {
      await this.invalidateConversationCache(participant.userId)
    }

    return conversation
  }

  /**
   * Update conversation status
   */
  async updateConversationStatus(dto: UpdateConversationStatusDto) {
    const { conversationId, status, userId } = dto

    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status,
        statusChangedAt: new Date(),
        statusChangedByUser: userId,
      },
      include: {
        participants: true,
      },
    })

    // Invalidate cache for all participants
    for (const participant of conversation.participants) {
      await this.invalidateConversationCache(participant.userId)
    }

    // Invalidate metrics cache
    await this.redis.del(`conversation:metrics:${conversationId}`)

    // Broadcast cache invalidation to all replicas
    const participantUserIds = conversation.participants.map(p => p.userId)
    await this.redisPubSub.publishMessage('cache:invalidate:conversations', {
      userIds: participantUserIds,
    })

    await this.redisPubSub.publishMessage('cache:invalidate:metrics', {
      conversationId,
    })

    return conversation
  }

  /**
   * Add label to conversation
   */
  async addLabel(dto: AddLabelDto, assignedBy: string) {
    const { conversationId, labelId } = dto

    const assignment = await this.prisma.conversationLabelAssignment.create({
      data: {
        conversationId,
        labelId,
        assignedBy,
      },
      include: {
        label: true,
      },
    })

    // Get all participants to invalidate cache
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    })

    if (conversation) {
      for (const participant of conversation.participants) {
        await this.invalidateConversationCache(participant.userId)
      }
    }

    return assignment
  }

  /**
   * Remove label from conversation
   */
  async removeLabel(dto: RemoveLabelDto) {
    const { conversationId, labelId } = dto

    await this.prisma.conversationLabelAssignment.delete({
      where: {
        conversationId_labelId: {
          conversationId,
          labelId,
        },
      },
    })

    // Get all participants to invalidate cache
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    })

    if (conversation) {
      for (const participant of conversation.participants) {
        await this.invalidateConversationCache(participant.userId)
      }
    }

    return { success: true }
  }

  /**
   * Get conversation metrics
   */
  async getConversationMetrics(conversationId: string): Promise<ConversationMetrics> {
    // Try cache first
    const cacheKey = `conversation:metrics:${conversationId}`
    const cached = await this.redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    // Get total messages count
    const totalMessages = await this.prisma.message.count({
      where: { conversationId },
    })

    // Get conversation with last activity
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        updatedAt: true,
        participants: {
          select: {
            unreadCount: true,
          },
        },
      },
    })

    const unreadMessages =
      conversation?.participants.reduce((sum, p) => sum + p.unreadCount, 0) ?? 0

    const metrics: ConversationMetrics = {
      totalMessages,
      unreadMessages,
      lastActivityAt: conversation?.updatedAt ?? new Date(),
    }

    // Cache for 5 minutes
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(metrics))

    return metrics
  }

  /**
   * Helper: Find existing conversation between user and provider/superadmin
   *
   * For USER_PROVIDER conversations:
   * - Searches by userId in participants AND metadata.providerId
   * - Provider conversations don't have provider user participants
   * - Provider ID is stored in metadata for organization-level visibility
   *
   * For USER_SUPERADMIN conversations:
   * - Searches by both user IDs in participants
   */
  private async findExistingConversation(
    userId: string,
    participantId: string,
    participantType: 'provider' | 'superadmin',
    contextType?: ContextType,
    contextId?: string
  ) {
    const type =
      participantType === 'provider'
        ? ConversationType.USER_PROVIDER
        : ConversationType.USER_SUPERADMIN

    if (participantType === 'provider') {
      // For provider conversations: find by user participant + metadata.providerId
      // + camp context. The provider ID is stored in metadata to enable
      // organization-level visibility; contextType/contextId scope the thread to
      // a single camp so the same provider's other camps get their own threads.
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          type: ConversationType.USER_PROVIDER,
          participants: {
            some: { userId },
          },
          metadata: {
            path: ['providerId'],
            equals: participantId,
          },
          contextType: contextType ?? ContextType.GENERAL,
          contextId: contextId ?? null,
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  profilePhotoUrl: true,
                },
              },
              provider: { select: { id: true, legalCompanyName: true, email: true } },
            },
          },
          lastMessage: true,
        },
      })

      return conversation
    } else {
      // For superadmin conversations: find by both user IDs in participants
      const conversations = await this.prisma.conversation.findMany({
        where: {
          type,
          participants: {
            every: {
              OR: [{ userId }, { userId: participantId }],
            },
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  profilePhotoUrl: true,
                },
              },
              provider: { select: { id: true, legalCompanyName: true, email: true } },
            },
          },
          lastMessage: true,
        },
      })

      // Find conversation with exactly these two participants
      return conversations.find(conv => {
        const participantIds = conv.participants.map(p => p.userId)
        return participantIds.includes(userId) && participantIds.includes(participantId)
      })
    }
  }

  /**
   * Helper: Invalidate conversation cache for a user
   * Now uses SCAN instead of KEYS and includes providerId
   * Called from RedisPubSubService for cross-replica cache invalidation
   */
  async invalidateConversationCache(userId: string): Promise<void> {
    const now = Date.now()
    const last = this.recentCacheInvalidations.get(userId) ?? 0
    if (now - last < this.CACHE_INVALIDATION_DEBOUNCE_MS) {
      return
    }
    this.recentCacheInvalidations.set(userId, now)

    const providerId = await this.getProviderIdForUser(userId)

    // Invalidate conversation list cache (all filter/limit/offset/context combinations)
    const pattern = `conversations:${userId}:*`
    await this.deleteKeysByPattern(pattern)

    // Invalidate conversation count cache (all filter/context combinations)
    const countPattern = `conversations:count:${userId}:*`
    await this.deleteKeysByPattern(countPattern)

    // Keep this as verbose to avoid log spam on high-volume conversations (receipts can trigger bursts).
    this.logger.verbose(`Invalidated conversation cache for user ${userId}`)
  }

  /**
   * Delete cache keys by pattern using SCAN (non-blocking)
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

  /**
   * Helper: Get provider ID for a user if they are a provider user
   * Returns null if user is not a provider user
   *
   * Public so that other services (e.g. MessagesService) can reuse it
   * without duplicating the provider-role / owner lookup logic.
   */
  async getProviderIdForUser(userId: string): Promise<string | null> {
    try {
      // First, try to find a provider-scoped role (for regular provider users)
      const userWithRoles = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      })

      if (!userWithRoles) {
        return null
      }

      // Check for provider-scoped role
      const providerRole = userWithRoles.roles?.find(
        (userRole: any) => userRole.role.providerId !== null
      )

      if (providerRole?.role?.providerId) {
        return providerRole.role.providerId
      }

      // If no provider-scoped role, check if user is a provider owner
      const ownedProvider = await this.prisma.provider.findUnique({
        where: { ownerId: userId },
        select: { id: true },
      })

      if (ownedProvider) {
        return ownedProvider.id
      }

      // User is not a provider user
      return null
    } catch (error) {
      this.logger.error(`Error getting provider ID for user ${userId}:`, error)
      return null
    }
  }

  /**
   * Warm cache for active users on application startup
   * Reduces cold start latency
   */
  async warmCache() {
    this.logger.log('Starting cache warming...')

    try {
      // Get list of recently active users (last 24 hours based on conversation activity)
      const activeUsers = await this.prisma.user.findMany({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        select: { id: true },
        take: 100, // Warm cache for top 100 active users
      })

      // Warm conversation cache for each user
      for (const user of activeUsers) {
        await this.getConversations({
          userId: user.id,
          filter: 'all',
          limit: 50,
          offset: 0,
        })
      }

      this.logger.log(`Cache warmed for ${activeUsers.length} users`)
    } catch (error) {
      this.logger.error('Cache warming failed', error)
    }
  }

  /**
   * Get Redis cache metrics for monitoring
   * Tracks memory usage, key count, and eviction rate
   */
  async getCacheMetrics(): Promise<{
    usedMemory: number
    maxMemory: number
    evictedKeys: number
    keyCount: number
    memoryFragmentationRatio: number
    hitRate?: number
  }> {
    const client = this.redis.getClient()

    // Get memory info from Redis
    const memoryInfo = await client.info('memory')
    const stats = await client.info('stats')
    const dbSize = await client.dbsize()

    // Parse memory metrics
    const metrics = {
      usedMemory: parseInt(this.parseRedisInfo(memoryInfo, 'used_memory'), 10),
      maxMemory: parseInt(this.parseRedisInfo(memoryInfo, 'maxmemory'), 10),
      evictedKeys: parseInt(this.parseRedisInfo(stats, 'evicted_keys'), 10),
      keyCount: dbSize,
      memoryFragmentationRatio: parseFloat(
        this.parseRedisInfo(memoryInfo, 'mem_fragmentation_ratio')
      ),
    }

    this.logger.debug('Cache metrics:', metrics)

    // Alert if memory usage is high
    const memoryUsagePercent = (metrics.usedMemory / metrics.maxMemory) * 100
    if (memoryUsagePercent > 80) {
      this.logger.warn(
        `High Redis memory usage: ${memoryUsagePercent.toFixed(1)}% (${metrics.usedMemory}/${metrics.maxMemory} bytes)`
      )
    }

    // Alert if eviction rate is high
    if (metrics.evictedKeys > 1000) {
      this.logger.warn(`High Redis eviction rate: ${metrics.evictedKeys} keys evicted`)
    }

    return metrics
  }

  /**
   * Parse Redis INFO command output
   * @param info - Raw INFO output
   * @param key - Key to extract
   * @returns Parsed value
   */
  private parseRedisInfo(info: string, key: string): string {
    const regex = new RegExp(`${key}:(.+)`)
    const match = info.match(regex)
    return match ? match[1].trim() : '0'
  }
}
