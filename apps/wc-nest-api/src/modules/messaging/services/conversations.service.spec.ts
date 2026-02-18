import { Test, TestingModule } from '@nestjs/testing'
import { ConversationsService } from './conversations.service'
import { PrismaService } from '../../../prisma/prisma.service'
import { RedisService } from '../../redis/redis.service'
import { NotFoundException, ForbiddenException } from '@nestjs/common'
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
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    conversationParticipant: {
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    messageReadReceipt: {
      createMany: jest.fn(),
    },
    conversationLabelAssignment: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((callback: any) => callback(mockPrismaService)),
  }

  const mockRedisService = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    isReady: jest.fn().mockReturnValue(true),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
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
      mockPrismaService.conversation.findMany.mockResolvedValue([])
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

    it('should create conversation without initial message', async () => {
      const dto = {
        userId: mockUserId,
        participantId: mockParticipantId,
        participantType: 'provider' as const,
      }

      mockPrismaService.conversation.findMany.mockResolvedValue([])
      mockPrismaService.conversation.create.mockResolvedValue(mockConversation)

      const result = await service.createConversation(dto)

      expect(result).toEqual(mockConversation)
      expect(prisma.conversation.create).toHaveBeenCalled()
    })

    it('should invalidate cache after creating conversation', async () => {
      const dto = {
        userId: mockUserId,
        participantId: mockParticipantId,
        participantType: 'provider' as const,
      }

      mockPrismaService.conversation.findMany.mockResolvedValue([])
      mockPrismaService.conversation.create.mockResolvedValue(mockConversation)

      await service.createConversation(dto)

      expect(redis.del).toHaveBeenCalled()
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

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            participants: expect.objectContaining({
              some: expect.objectContaining({
                userId: mockUserId,
                unreadCount: { gt: 0 },
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
      mockPrismaService.conversationParticipant.update.mockResolvedValue({})

      const result = await service.markAllAsRead(mockConversationId, mockUserId)

      expect(result.markedAsRead).toBe(2)
      expect(prisma.message.findMany).toHaveBeenCalled()
      expect(prisma.messageReadReceipt.createMany).toHaveBeenCalled()
      expect(prisma.conversationParticipant.update).toHaveBeenCalled()
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
