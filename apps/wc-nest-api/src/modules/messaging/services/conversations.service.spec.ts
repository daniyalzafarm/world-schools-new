import { Test, TestingModule } from '@nestjs/testing'
import { ConversationsService, buildProviderConversationKey } from './conversations.service'
import { PrismaService } from '../../../prisma/prisma.service'
import { RedisService } from '../../redis/redis.service'
import { RedisPubSubService } from './redis-pub-sub.service'
import { ConfigService } from '../../../config/config.service'
import { NotFoundException, ForbiddenException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { ConversationType, ConversationStatus, ContextType } from '../../../generated/client/client'

describe('ConversationsService', () => {
  let service: ConversationsService
  let prisma: PrismaService
  let redis: RedisService

  // Mock data
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000'
  const mockParticipantId = '123e4567-e89b-12d3-a456-426614174001'
  const mockConversationId = '123e4567-e89b-12d3-a456-426614174002'
  const mockLabelId = '123e4567-e89b-12d3-a456-426614174003'

  const mockConversation = {
    id: mockConversationId,
    type: ConversationType.USER_PROVIDER,
    subject: null,
    contextType: ContextType.BOOKING,
    contextId: 'booking-123',
    metadata: null,
    assignedToId: null,
    assignedAt: null,
    assignedBy: null,
    status: ConversationStatus.OPEN,
    openedAt: new Date(),
    statusChangedAt: null,
    statusChangedByUser: null,
    messageCount: 0,
    participantCount: 2,
    avgResponseTime: null,
    lastActivityAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    lastMessageId: null,
    participants: [
      {
        id: 'participant-1',
        conversationId: mockConversationId,
        userId: mockUserId,
        providerId: null,
        pinned: false,
        starred: false,
        muted: false,
        archived: false,
        unreadCount: 0,
        lastReadAt: null,
        joinedAt: new Date(),
        user: {
          id: mockUserId,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
        provider: null,
      },
      {
        id: 'participant-2',
        conversationId: mockConversationId,
        userId: mockParticipantId,
        providerId: mockParticipantId,
        pinned: false,
        starred: false,
        muted: false,
        archived: false,
        unreadCount: 0,
        lastReadAt: null,
        joinedAt: new Date(),
        user: {
          id: mockParticipantId,
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
        },
        provider: {
          id: mockParticipantId,
          legalCompanyName: 'Test Provider',
          email: 'provider@example.com',
        },
      },
    ],
    lastMessage: null,
    labels: [],
  }

  const mockPrismaService: any = {
    conversation: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    conversationParticipant: {
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      findFirst: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      updateMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    messageReadReceipt: {
      createMany: jest.fn(),
    },
    conversationLabelAssignment: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    // Used by camp-identity enrichment (buildCampContextMap) and the
    // provider-id lookup (getProviderIdForUser). Default to empty so existing
    // tests see no enrichment unless they opt in.
    booking: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    camp: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    provider: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn((callback: any) => callback(mockPrismaService)),
  }

  const mockRedisService = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    isReady: jest.fn().mockReturnValue(true),
    getClient: jest
      .fn()
      .mockReturnValue({ scan: jest.fn().mockResolvedValue(['0', []]), del: jest.fn() }),
  }

  const mockRedisPubSubService = {
    publishMessage: jest.fn(),
    getProviderUsers: jest.fn().mockResolvedValue([]),
  }

  const mockConfigService = {
    azureStorageConfig: { accountName: 'acct', accountKey: 'key', containerName: 'container' },
  }

  const mockEventEmitter = {
    emit: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: RedisPubSubService, useValue: mockRedisPubSubService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile()

    service = module.get<ConversationsService>(ConversationsService)
    prisma = module.get<PrismaService>(PrismaService)
    redis = module.get<RedisService>(RedisService)

    // Reset all mocks before each test
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('createConversation', () => {
    it('should create a new conversation with initial message', async () => {
      const dto = {
        userId: mockUserId,
        participantId: mockParticipantId,
        participantType: 'provider' as const,
        contextType: ContextType.BOOKING,
        contextId: 'booking-123',
        initialMessage: 'Hello, I have a question',
      }

      // Mock findExistingConversation to return null (no existing conversation)
      mockPrismaService.conversation.findFirst.mockResolvedValue(null)
      mockPrismaService.conversation.findMany.mockResolvedValue([])
      mockPrismaService.provider.findUnique.mockResolvedValue({
        id: mockParticipantId,
        legalCompanyName: 'Test Provider',
        email: 'provider@example.com',
      })
      mockPrismaService.conversation.create.mockResolvedValue(mockConversation)

      const result = await service.createConversation(dto)

      expect(result).toEqual(mockConversation)
      expect(prisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: ConversationType.USER_PROVIDER,
            contextType: dto.contextType,
            contextId: dto.contextId,
          }),
        })
      )
    })

    it('scopes the existing-conversation lookup to the camp and sets a per-camp dedupeKey', async () => {
      const dto = {
        userId: mockUserId,
        participantId: mockParticipantId,
        participantType: 'provider' as const,
        contextType: ContextType.CAMP,
        contextId: 'camp-abc',
        initialMessage: 'Is there availability?',
      }

      mockPrismaService.conversation.findFirst.mockResolvedValue(null)
      mockPrismaService.conversation.findMany.mockResolvedValue([])
      mockPrismaService.provider.findUnique.mockResolvedValue({
        id: mockParticipantId,
        legalCompanyName: 'Test Provider',
        email: 'provider@example.com',
      })
      mockPrismaService.conversation.create.mockResolvedValue(mockConversation)
      mockPrismaService.message.findFirst = jest.fn().mockResolvedValue({ id: 'msg-1' })

      await service.createConversation(dto)

      // Uniqueness lookup is keyed per (parent, provider, camp) — the camp
      // context must be part of the findFirst where clause.
      expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contextType: ContextType.CAMP,
            contextId: 'camp-abc',
          }),
        })
      )

      // The DB-level unique key is persisted on create.
      expect(prisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dedupeKey: buildProviderConversationKey(
              mockUserId,
              mockParticipantId,
              ContextType.CAMP,
              'camp-abc'
            ),
          }),
        })
      )

      // The inline initial message bumps lastActivityAt (the recency field) so
      // the new conversation sorts to the top, matching sendMessage().
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastMessageId: 'msg-1',
            lastActivityAt: expect.any(Date),
          }),
        })
      )

      // The inline initial message fires the provider "new from family" notification
      // (so all messaging-permitted staff are alerted on the first message).
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'notification.dispatch',
        expect.objectContaining({
          context: expect.objectContaining({
            conversationId: mockConversationId,
            messageId: 'msg-1',
            providerId: mockParticipantId,
          }),
        })
      )
    })

    it('should reject creating a conversation without an initial message', async () => {
      const dto = {
        userId: mockUserId,
        participantId: mockParticipantId,
        participantType: 'provider' as const,
      }

      // Initial message is required (conversations are created on first send).
      await expect(service.createConversation(dto)).rejects.toThrow('Initial message is required')
      expect(prisma.conversation.create).not.toHaveBeenCalled()
    })

    it('should invalidate cache after creating conversation', async () => {
      const dto = {
        userId: mockUserId,
        participantId: mockParticipantId,
        participantType: 'provider' as const,
        initialMessage: 'Hello there',
      }

      mockPrismaService.conversation.findFirst.mockResolvedValue(null)
      mockPrismaService.provider.findUnique.mockResolvedValue({
        id: mockParticipantId,
        legalCompanyName: 'Test Provider',
        email: 'provider@example.com',
      })
      mockPrismaService.conversation.create.mockResolvedValue(mockConversation)
      mockPrismaService.message.findFirst = jest.fn().mockResolvedValue({ id: 'msg-1' })

      await service.createConversation(dto)

      // Cross-replica cache invalidation is broadcast via Redis pub/sub.
      expect(mockRedisPubSubService.publishMessage).toHaveBeenCalled()
    })
  })

  describe('getConversations', () => {
    it('should return all conversations for a user', async () => {
      const dto = {
        userId: mockUserId,
        filter: 'all' as const,
        limit: 50,
        offset: 0,
      }

      mockPrismaService.conversation.findMany.mockResolvedValue([mockConversation])
      mockRedisService.get.mockResolvedValue(null)

      const result = await service.getConversations(dto)

      expect(result).toEqual([mockConversation])
      expect(prisma.conversation.findMany).toHaveBeenCalled()
      expect(redis.setex).toHaveBeenCalled()
    })

    it('should filter unread conversations', async () => {
      const dto = {
        userId: mockUserId,
        filter: 'unread' as const,
        limit: 50,
        offset: 0,
      }

      mockPrismaService.conversation.findMany.mockResolvedValue([mockConversation])
      mockRedisService.get.mockResolvedValue(null)

      await service.getConversations(dto)

      // Unread = real unread messages OR a manual "mark as unread".
      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            participants: expect.objectContaining({
              some: expect.objectContaining({
                userId: mockUserId,
                OR: [{ unreadCount: { gt: 0 } }, { manuallyUnread: true }],
              }),
            }),
          }),
        })
      )
    })

    it('should use cached data when available', async () => {
      const dto = {
        userId: mockUserId,
        filter: 'all' as const,
        limit: 50,
        offset: 0,
      }

      // Serialize dates to strings as they would be in JSON
      const cachedConversation = JSON.parse(JSON.stringify(mockConversation))
      const cachedData = [cachedConversation]

      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedData))

      const result = await service.getConversations(dto)

      expect(result).toEqual(cachedData)
      expect(prisma.conversation.findMany).not.toHaveBeenCalled()
    })

    it('orders by lastActivityAt desc with a deterministic createdAt tiebreak', async () => {
      const dto = {
        userId: mockUserId,
        filter: 'all' as const,
        limit: 50,
        offset: 0,
      }

      mockPrismaService.conversation.findMany.mockResolvedValue([mockConversation])
      mockRedisService.get.mockResolvedValue(null)

      await service.getConversations(dto)

      // Recency must come from lastActivityAt (the last-message field), not
      // updatedAt (which bumps on assignment/status/etc.).
      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ lastActivityAt: 'desc' }, { createdAt: 'desc' }],
        })
      )
    })

    it('should handle pagination correctly', async () => {
      const dto = {
        userId: mockUserId,
        filter: 'all' as const,
        limit: 10,
        offset: 20,
      }

      mockPrismaService.conversation.findMany.mockResolvedValue([mockConversation])
      mockRedisService.get.mockResolvedValue(null)

      const result = await service.getConversations(dto)

      expect(result).toEqual([mockConversation])
      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      )
    })
  })

  describe('getConversationById', () => {
    it('should return conversation by ID', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation)

      const result = await service.getConversationById(mockConversationId, mockUserId)

      expect(result).toEqual(mockConversation)
      expect(prisma.conversation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockConversationId },
        })
      )
    })

    it('should throw NotFoundException if conversation not found', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(null)

      await expect(service.getConversationById(mockConversationId, mockUserId)).rejects.toThrow(
        NotFoundException
      )
    })

    it('should throw ForbiddenException if user is not a participant', async () => {
      const conversationWithoutUser = {
        ...mockConversation,
        participants: [
          {
            ...mockConversation.participants[1],
            userId: 'different-user-id',
          },
        ],
      }

      mockPrismaService.conversation.findUnique.mockResolvedValue(conversationWithoutUser)

      await expect(service.getConversationById(mockConversationId, mockUserId)).rejects.toThrow(
        ForbiddenException
      )
    })

    it('grants access to a provider-org member who has no participant row yet (parent-initiated thread)', async () => {
      const providerUserId = 'provider-user-id'
      const providerOrgId = mockParticipantId
      // Parent-initiated USER_PROVIDER thread: only the parent is a participant,
      // the provider org is referenced via metadata.providerId.
      const parentInitiatedConversation = {
        ...mockConversation,
        metadata: { providerId: providerOrgId },
        participants: [mockConversation.participants[0]],
      }
      mockPrismaService.conversation.findUnique.mockResolvedValue(parentInitiatedConversation)
      // getProviderIdForUser(providerUserId) → providerOrgId (provider-scoped role)
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: providerUserId,
        roles: [{ role: { providerId: providerOrgId } }],
      })

      await expect(
        service.getConversationById(mockConversationId, providerUserId)
      ).resolves.toBeDefined()
    })

    it('throws ForbiddenException for a non-participant whose provider org does not match', async () => {
      const otherProviderUserId = 'other-provider-user-id'
      const parentInitiatedConversation = {
        ...mockConversation,
        metadata: { providerId: mockParticipantId },
        participants: [mockConversation.participants[0]],
      }
      mockPrismaService.conversation.findUnique.mockResolvedValue(parentInitiatedConversation)
      // getProviderIdForUser → a different provider org
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: otherProviderUserId,
        roles: [{ role: { providerId: 'different-provider-org' } }],
      })

      await expect(
        service.getConversationById(mockConversationId, otherProviderUserId)
      ).rejects.toThrow(ForbiddenException)
    })
  })

  describe('updateConversationSettings', () => {
    it('should update conversation settings', async () => {
      const dto = {
        conversationId: mockConversationId,
        userId: mockUserId,
        pinned: true,
        starred: true,
      }

      const updatedParticipant = {
        ...mockConversation.participants[0],
        pinned: true,
        starred: true,
      }

      mockPrismaService.conversationParticipant.findUnique.mockResolvedValue(
        mockConversation.participants[0]
      )
      mockPrismaService.conversationParticipant.update.mockResolvedValue(updatedParticipant)

      const result = await service.updateConversationSettings(dto)

      expect(result).toEqual(updatedParticipant)
      expect(prisma.conversationParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversationId_userId: {
              conversationId: mockConversationId,
              userId: mockUserId,
            },
          }),
          data: expect.objectContaining({
            pinned: true,
            starred: true,
          }),
        })
      )
    })

    it('should invalidate cache after updating settings', async () => {
      const dto = {
        conversationId: mockConversationId,
        userId: mockUserId,
        archived: true,
      }

      mockPrismaService.conversationParticipant.findUnique.mockResolvedValue(
        mockConversation.participants[0]
      )
      mockPrismaService.conversationParticipant.update.mockResolvedValue(
        mockConversation.participants[0]
      )

      await service.updateConversationSettings(dto)

      expect(redis.del).toHaveBeenCalled()
    })
  })

  describe('markAllAsRead', () => {
    it('should mark all messages as read in a conversation', async () => {
      const unreadMessages = [{ id: 'msg-1' }, { id: 'msg-2' }]

      mockPrismaService.message.findMany.mockResolvedValue(unreadMessages)
      mockPrismaService.messageReadReceipt.createMany.mockResolvedValue({ count: 2 })
      mockPrismaService.conversationParticipant.updateMany.mockResolvedValue({ count: 1 })

      const result = await service.markAllAsRead(mockConversationId, mockUserId)

      expect(result.markedAsRead).toBe(2)
      expect(prisma.message.findMany).toHaveBeenCalled()
      expect(prisma.messageReadReceipt.createMany).toHaveBeenCalled()
      // updateMany (not update) so it never throws for users without a
      // participant row (e.g. provider users seeing conversations via their org).
      expect(prisma.conversationParticipant.updateMany).toHaveBeenCalled()
    })

    it('should not throw when the user has no participant row (provider user)', async () => {
      const unreadMessages = [{ id: 'msg-1' }]

      mockPrismaService.message.findMany.mockResolvedValue(unreadMessages)
      mockPrismaService.messageReadReceipt.createMany.mockResolvedValue({ count: 1 })
      // No participant row → updateMany matches nothing (count 0) and does not throw.
      mockPrismaService.conversationParticipant.updateMany.mockResolvedValue({ count: 0 })

      const result = await service.markAllAsRead(mockConversationId, mockUserId)

      expect(result.markedAsRead).toBe(1)
      expect(prisma.messageReadReceipt.createMany).toHaveBeenCalled()
    })

    it('clears a manual unread flag even when there are no unread messages', async () => {
      // No unread messages, but the conversation was manually marked unread.
      mockPrismaService.message.findMany.mockResolvedValue([])
      mockPrismaService.conversationParticipant.findFirst.mockResolvedValue({
        manuallyUnread: true,
      })
      mockPrismaService.conversationParticipant.updateMany.mockResolvedValue({ count: 1 })

      const result = await service.markAllAsRead(mockConversationId, mockUserId)

      expect(result.markedAsRead).toBe(0)
      // No read receipts (nothing to read) ...
      expect(prisma.messageReadReceipt.createMany).not.toHaveBeenCalled()
      // ... but the participant is still reset so the manual-unread flag clears.
      expect(prisma.conversationParticipant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { unreadCount: 0, manuallyUnread: false },
        })
      )
    })
  })

  describe('markConversationUnread', () => {
    it('sets the manual unread flag for the user', async () => {
      mockPrismaService.conversationParticipant.updateMany.mockResolvedValue({ count: 1 })

      const result = await service.markConversationUnread(mockConversationId, mockUserId)

      expect(result.manuallyUnread).toBe(true)
      expect(prisma.conversationParticipant.updateMany).toHaveBeenCalledWith({
        where: { conversationId: mockConversationId, userId: mockUserId },
        data: { manuallyUnread: true },
      })
    })

    it('no-ops when the user has no participant row', async () => {
      mockPrismaService.conversationParticipant.updateMany.mockResolvedValue({ count: 0 })

      const result = await service.markConversationUnread(mockConversationId, mockUserId)

      expect(result.manuallyUnread).toBe(false)
    })
  })

  describe('camp identity enrichment', () => {
    const campConversation = {
      ...mockConversation,
      id: 'camp-conv-1',
      contextType: ContextType.CAMP,
      contextId: 'camp-1',
      metadata: { providerId: mockParticipantId },
      participants: [mockConversation.participants[0]],
    }

    it('enriches camp-context conversations with camp name, location and photo', async () => {
      mockRedisService.get.mockResolvedValue(null)
      mockPrismaService.conversation.findMany.mockResolvedValue([campConversation])
      mockPrismaService.provider.findMany.mockResolvedValue([
        { id: mockParticipantId, legalCompanyName: 'Test Provider', email: 'p@example.com' },
      ])
      mockPrismaService.camp.findMany.mockResolvedValue([
        {
          id: 'camp-1',
          name: 'Sunny Camp',
          locationName: 'Swiss Alps, Switzerland',
          photos: [
            { url: 'https://cdn/secondary.jpg', isPrimary: false },
            { url: 'https://cdn/primary.jpg', isPrimary: true },
          ],
        },
      ])

      const result = await service.getConversations({
        userId: mockUserId,
        filter: 'all',
        limit: 50,
        offset: 0,
      })

      expect(result[0].campName).toBe('Sunny Camp')
      expect(result[0].campLocation).toBe('Swiss Alps, Switzerland')
      expect(result[0].campPhotoUrl).toBe('https://cdn/primary.jpg')
    })
  })

  describe('provider unread (computed from read receipts)', () => {
    const providerUserId = 'provider-user-1'
    const providerOrgId = 'provider-org-1'
    const providerConversation = {
      ...mockConversation,
      id: 'prov-conv-1',
      metadata: { providerId: providerOrgId },
      participants: [mockConversation.participants[0]], // only the booking user; no provider row
    }

    // Make getProviderIdForUser resolve to the provider org for the requesting user.
    const asProviderUser = () =>
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: providerUserId,
        roles: [{ role: { providerId: providerOrgId } }],
      })

    it('exposes per-conversation unread for a provider user via the virtual participant', async () => {
      asProviderUser()
      mockRedisService.get.mockResolvedValue(null)
      mockPrismaService.conversation.findMany.mockResolvedValue([providerConversation])
      mockPrismaService.provider.findMany.mockResolvedValue([
        { id: providerOrgId, legalCompanyName: 'Org', email: 'o@example.com' },
      ])
      mockPrismaService.message.groupBy.mockResolvedValue([
        { conversationId: 'prov-conv-1', _count: { _all: 3 } },
      ])

      const result = await service.getConversations({
        userId: providerUserId,
        filter: 'all',
        limit: 50,
        offset: 0,
      })

      const ownParticipant = result[0].participants.find((p: any) => p.userId === providerUserId)
      expect(ownParticipant).toBeDefined()
      expect(ownParticipant.unreadCount).toBe(3)
    })
  })

  describe('assignConversation', () => {
    it('should assign conversation to a user', async () => {
      const dto = {
        conversationId: mockConversationId,
        assignedToId: mockUserId,
        assignedBy: mockParticipantId,
      }

      const updatedConversation = {
        ...mockConversation,
        assignedToId: mockUserId,
        assignedBy: mockParticipantId,
        assignedAt: new Date(),
      }

      mockPrismaService.conversation.update.mockResolvedValue(updatedConversation)

      const result = await service.assignConversation(dto)

      expect(result).toEqual(updatedConversation)
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockConversationId },
          data: expect.objectContaining({
            assignedToId: mockUserId,
            assignedBy: mockParticipantId,
          }),
        })
      )
    })
  })

  describe('updateConversationStatus', () => {
    it('should update conversation status', async () => {
      const dto = {
        conversationId: mockConversationId,
        status: ConversationStatus.CLOSED,
        userId: mockUserId,
      }

      const updatedConversation = {
        ...mockConversation,
        status: ConversationStatus.CLOSED,
        statusChangedAt: new Date(),
        statusChangedByUser: mockUserId,
      }

      mockPrismaService.conversation.update.mockResolvedValue(updatedConversation)

      const result = await service.updateConversationStatus(dto)

      expect(result).toEqual(updatedConversation)
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockConversationId },
          data: expect.objectContaining({
            status: ConversationStatus.CLOSED,
            statusChangedByUser: mockUserId,
          }),
        })
      )
    })
  })

  describe('addLabel', () => {
    it('should add label to conversation', async () => {
      const dto = {
        conversationId: mockConversationId,
        labelId: mockLabelId,
      }

      const labelAssignment = {
        conversationId: mockConversationId,
        labelId: mockLabelId,
        assignedBy: mockUserId,
        assignedAt: new Date(),
        label: {
          id: mockLabelId,
          name: 'Important',
          color: '#FF0000',
          createdAt: new Date(),
        },
      }

      mockPrismaService.conversationLabelAssignment.create.mockResolvedValue(labelAssignment)

      const result = await service.addLabel(dto, mockUserId)

      expect(result).toEqual(labelAssignment)
      expect(prisma.conversationLabelAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: mockConversationId,
            labelId: mockLabelId,
            assignedBy: mockUserId,
          }),
        })
      )
    })
  })

  describe('removeLabel', () => {
    it('should remove label from conversation', async () => {
      const dto = {
        conversationId: mockConversationId,
        labelId: mockLabelId,
      }

      mockPrismaService.conversationLabelAssignment.delete.mockResolvedValue({})

      await service.removeLabel(dto)

      expect(prisma.conversationLabelAssignment.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversationId_labelId: {
              conversationId: mockConversationId,
              labelId: mockLabelId,
            },
          }),
        })
      )
    })
  })

  describe('getConversationMetrics', () => {
    it('should return conversation metrics from cache', async () => {
      const cachedMetrics = {
        totalMessages: 10,
        unreadMessages: 2,
        lastActivityAt: new Date().toISOString(),
        averageResponseTime: 300,
      }

      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedMetrics))

      const result = await service.getConversationMetrics(mockConversationId)

      expect(result.totalMessages).toBe(10)
      expect(result.unreadMessages).toBe(2)
      expect(prisma.conversation.findUnique).not.toHaveBeenCalled()
    })

    it('should calculate and cache metrics if not in cache', async () => {
      mockRedisService.get.mockResolvedValue(null)
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation)
      mockPrismaService.message.count.mockResolvedValue(0)

      const result = await service.getConversationMetrics(mockConversationId)

      expect(result.totalMessages).toBe(0)
      expect(result.unreadMessages).toBe(0)
      expect(redis.setex).toHaveBeenCalled()
    })
  })
})
