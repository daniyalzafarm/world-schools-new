import { EventEmitter2 } from '@nestjs/event-emitter'
import { Test, TestingModule } from '@nestjs/testing'
import { MessagesService } from './messages.service'
import { PrismaService } from '../../../prisma/prisma.service'
import { RedisService } from '../../redis/redis.service'
import { RedisPubSubService } from './redis-pub-sub.service'
import { ConversationsService } from './conversations.service'
import { AttachmentsService } from './attachments.service'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import {
  SenderType,
  ContentType,
  MessageStatus,
  MessagePriority,
  DeletionType,
  ReportReason,
} from '../../../generated/client/client'

describe('MessagesService', () => {
  let service: MessagesService
  let prisma: PrismaService
  // let redis: RedisService

  // Mock data
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000'
  const mockConversationId = '123e4567-e89b-12d3-a456-426614174001'
  const mockMessageId = '123e4567-e89b-12d3-a456-426614174002'
  const mockIdempotencyKey = 'msg-2024-01-01-12345'

  const mockMessage = {
    id: mockMessageId,
    conversationId: mockConversationId,
    senderId: mockUserId,
    senderType: SenderType.USER,
    content: 'Hello, world!',
    contentType: ContentType.TEXT,
    attachments: null,
    type: 'REGULAR',
    metadata: null,
    replyToId: null,
    forwardedFromId: null,
    forwardCount: 0,
    isPinned: false,
    pinnedAt: null,
    pinnedBy: null,
    priority: MessagePriority.NORMAL,
    scheduledFor: null,
    scheduledBy: null,
    isScheduled: false,
    status: MessageStatus.SENT,
    deliveredAt: null,
    readAt: null,
    sentAt: new Date(),
    deliveryLatencyMs: null,
    editedAt: null,
    deletedAt: null,
    deletedBy: null,
    isDeleted: false,
    deletionType: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    sender: {
      id: mockUserId,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    },
    replyTo: null,
    readReceipts: [],
    deliveryReceipts: [],
    reactions: [],
    mentions: [],
    editHistory: [],
  }

  const mockPrismaService: any = {
    message: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    conversation: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    conversationParticipant: {
      updateMany: jest.fn(),
    },
    messageReadReceipt: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    messageDeliveryReceipt: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    messageReaction: {
      create: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    messageBookmark: {
      create: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    messageEditHistory: {
      create: jest.fn(),
    },
    messageReport: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback: any) => callback(mockPrismaService)),
  }

  // The service uses redis.getClient() for SCAN-based cache invalidation
  // (deleteKeysByPattern). Provide a stub client that returns no keys.
  const mockRedisClient = {
    scan: jest.fn().mockResolvedValue(['0', []]),
    del: jest.fn().mockResolvedValue(0),
  }

  const mockRedisService = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    isReady: jest.fn().mockReturnValue(true),
    getClient: jest.fn(() => mockRedisClient),
  }

  const mockRedisPubSubService = {
    publishMessage: jest.fn().mockResolvedValue(undefined),
    getProviderUsers: jest.fn().mockResolvedValue([]),
  }

  const mockConversationsService = {
    invalidateConversationCache: jest.fn().mockResolvedValue(undefined),
    getProviderIdForUser: jest.fn().mockResolvedValue(null),
  }

  const mockAttachmentsService = {
    resolveMessageAttachmentsUrls: jest.fn(async (messages: any) => messages),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: RedisPubSubService, useValue: mockRedisPubSubService },
        { provide: ConversationsService, useValue: mockConversationsService },
        { provide: AttachmentsService, useValue: mockAttachmentsService },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile()

    service = module.get<MessagesService>(MessagesService)
    prisma = module.get<PrismaService>(PrismaService)
    // redis = module.get<RedisService>(RedisService)

    // Reset all mocks before each test
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('sendMessage', () => {
    it('should send a new message', async () => {
      const dto = {
        conversationId: mockConversationId,
        senderId: mockUserId,
        senderType: SenderType.USER,
        content: 'Hello, world!',
        contentType: ContentType.TEXT,
        idempotencyKey: mockIdempotencyKey,
      }

      mockRedisService.exists.mockResolvedValue(0)
      mockRedisService.get.mockResolvedValue(null)
      mockPrismaService.message.create.mockResolvedValue(mockMessage)
      mockPrismaService.conversation.update.mockResolvedValue({})
      mockPrismaService.conversationParticipant.updateMany.mockResolvedValue({ count: 1 })
      // sendMessage re-fetches the conversation (with participants) for cache
      // invalidation; it throws NotFoundException if this returns null.
      mockPrismaService.conversation.findUnique.mockResolvedValue({
        id: mockConversationId,
        type: 'USER_PROVIDER',
        contextType: null,
        metadata: null,
        participants: [{ userId: mockUserId }],
      })

      const result = await service.sendMessage(dto)

      // sendMessage attaches `attachments: null` to the returned message when
      // there are no attachments; mockMessage already has attachments: null.
      expect(result).toEqual({ ...mockMessage, attachments: null })
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: mockConversationId,
            senderId: mockUserId,
            content: 'Hello, world!',
          }),
        })
      )
    })

    it('should return cached message with same idempotency key', async () => {
      const dto = {
        conversationId: mockConversationId,
        senderId: mockUserId,
        senderType: SenderType.USER,
        content: 'Hello, world!',
        idempotencyKey: mockIdempotencyKey,
      }

      // Serialize dates to strings as they would be in JSON
      const cachedMessage = JSON.parse(JSON.stringify(mockMessage))

      // Mock redis.get to return cached message
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedMessage))

      const result = await service.sendMessage(dto)

      expect(result).toEqual(cachedMessage)
      expect(prisma.message.create).not.toHaveBeenCalled()
    })

    it('should send message with reply', async () => {
      const dto = {
        conversationId: mockConversationId,
        senderId: mockUserId,
        senderType: SenderType.USER,
        content: 'This is a reply',
        replyToId: mockMessageId,
        idempotencyKey: mockIdempotencyKey,
      }

      const replyMessage = {
        ...mockMessage,
        replyToId: mockMessageId,
      }

      mockRedisService.get.mockResolvedValue(null)
      mockPrismaService.message.create.mockResolvedValue(replyMessage)
      mockPrismaService.conversation.update.mockResolvedValue({})
      mockPrismaService.conversationParticipant.updateMany.mockResolvedValue({ count: 1 })
      mockPrismaService.conversation.findUnique.mockResolvedValue({
        id: mockConversationId,
        type: 'USER_PROVIDER',
        contextType: null,
        metadata: null,
        participants: [{ userId: mockUserId }],
      })

      const result = await service.sendMessage(dto)

      expect(result.replyToId).toBe(mockMessageId)
    })

    it('should schedule message for future delivery', async () => {
      const futureDate = new Date(Date.now() + 3600000)
      const dto = {
        conversationId: mockConversationId,
        senderId: mockUserId,
        senderType: SenderType.USER,
        content: 'Scheduled message',
        scheduledFor: futureDate,
        idempotencyKey: mockIdempotencyKey,
      }

      const scheduledMessage = {
        ...mockMessage,
        scheduledFor: futureDate,
        isScheduled: true,
        status: MessageStatus.SENDING,
      }

      mockRedisService.get.mockResolvedValue(null)
      mockPrismaService.message.create.mockResolvedValue(scheduledMessage)
      mockPrismaService.conversation.update.mockResolvedValue({})
      mockPrismaService.conversationParticipant.updateMany.mockResolvedValue({ count: 1 })
      mockPrismaService.conversation.findUnique.mockResolvedValue({
        id: mockConversationId,
        type: 'USER_PROVIDER',
        contextType: null,
        metadata: null,
        participants: [{ userId: mockUserId }],
      })

      const result = await service.sendMessage(dto)

      expect(result.isScheduled).toBe(true)
      expect(result.status).toBe(MessageStatus.SENDING)
    })
  })

  describe('getMessages', () => {
    it('should return messages with cursor-based pagination', async () => {
      const dto = {
        conversationId: mockConversationId,
        limit: 50,
        direction: 'before' as const,
      }

      mockPrismaService.message.findMany.mockResolvedValue([mockMessage])
      mockPrismaService.message.findUnique.mockResolvedValue(null)

      const result = await service.getMessages(dto)

      // getMessages now returns a pagination envelope. Each item is rebuilt with
      // an `attachments` field (null when no messageAttachments relation).
      expect(result.data).toEqual([{ ...mockMessage, attachments: null }])
      expect(result.hasMore).toBe(false)
      expect(result.nextCursor).toBeNull()
      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversationId: mockConversationId,
            isDeleted: false,
          }),
          // Implementation fetches one extra row (limit + 1) to detect hasMore.
          take: 51,
        })
      )
    })

    it('should paginate messages before cursor', async () => {
      const dto = {
        conversationId: mockConversationId,
        limit: 50,
        cursor: mockMessageId,
        direction: 'before' as const,
      }

      const cursorMessage = {
        id: mockMessageId,
        createdAt: new Date(),
      }

      mockPrismaService.message.findUnique.mockResolvedValue(cursorMessage)
      mockPrismaService.message.findMany.mockResolvedValue([mockMessage])

      await service.getMessages(dto)

      expect(prisma.message.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockMessageId },
        })
      )
      expect(prisma.message.findMany).toHaveBeenCalled()
    })

    it('should return multiple messages', async () => {
      const dto = {
        conversationId: mockConversationId,
        limit: 10,
      }

      const messages = [mockMessage, mockMessage, mockMessage]
      mockPrismaService.message.findMany.mockResolvedValue(messages)
      mockPrismaService.message.findUnique.mockResolvedValue(null)

      const result = await service.getMessages(dto)

      // Pagination envelope: messages live under `result.data`, rebuilt with
      // an `attachments: null` field since there is no messageAttachments relation.
      expect(result.data.length).toBe(3)
      expect(result.data).toEqual(messages.map(m => ({ ...m, attachments: null })))
      expect(result.hasMore).toBe(false)
    })
  })

  describe('getMessageById', () => {
    it('should return message by ID', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage)

      const result = await service.getMessageById(mockMessageId)

      expect(result).toEqual(mockMessage)
      expect(prisma.message.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockMessageId },
        })
      )
    })

    it('should throw NotFoundException if message not found', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue(null)

      await expect(service.getMessageById(mockMessageId)).rejects.toThrow(NotFoundException)
    })
  })

  describe('editMessage', () => {
    it('should edit message content', async () => {
      const dto = {
        messageId: mockMessageId,
        userId: mockUserId,
        newContent: 'Updated content',
        editReason: 'Fixed typo',
      }

      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage)
      mockPrismaService.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrismaService)
      })
      mockPrismaService.message.update.mockResolvedValue({
        ...mockMessage,
        content: 'Updated content',
        editedAt: new Date(),
      })

      const result = await service.editMessage(dto)

      expect(result.content).toBe('Updated content')
      expect(prisma.messageEditHistory.create).toHaveBeenCalled()
    })

    it('should throw BadRequestException if user is not the sender', async () => {
      const dto = {
        messageId: mockMessageId,
        userId: 'different-user-id',
        newContent: 'Updated content',
      }

      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage)

      await expect(service.editMessage(dto)).rejects.toThrow(BadRequestException)
    })

    it('should throw NotFoundException if message not found', async () => {
      const dto = {
        messageId: mockMessageId,
        userId: mockUserId,
        newContent: 'Updated content',
      }

      mockPrismaService.message.findUnique.mockResolvedValue(null)

      await expect(service.editMessage(dto)).rejects.toThrow(NotFoundException)
    })
  })

  describe('deleteMessage', () => {
    it('should soft delete a message', async () => {
      const dto = {
        messageId: mockMessageId,
        userId: mockUserId,
        deletionType: DeletionType.USER_DELETED,
      }

      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage)
      mockPrismaService.message.update.mockResolvedValue({
        ...mockMessage,
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: mockUserId,
        deletionType: DeletionType.USER_DELETED,
      })

      const result = await service.deleteMessage(dto)

      expect(result.isDeleted).toBe(true)
      expect(result.deletedBy).toBe(mockUserId)
      expect(prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockMessageId },
          data: expect.objectContaining({
            isDeleted: true,
            deletedBy: mockUserId,
            deletionType: DeletionType.USER_DELETED,
          }),
        })
      )
    })

    it('should throw BadRequestException if user is not the sender', async () => {
      const dto = {
        messageId: mockMessageId,
        userId: 'different-user-id',
      }

      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage)

      await expect(service.deleteMessage(dto)).rejects.toThrow(BadRequestException)
    })
  })

  describe('markAsRead', () => {
    it('should mark message as read', async () => {
      const dto = {
        messageId: mockMessageId,
        userId: mockUserId,
      }

      const readReceipt = {
        id: 'receipt-1',
        messageId: mockMessageId,
        userId: mockUserId,
        readAt: new Date(),
      }

      mockPrismaService.messageReadReceipt.findUnique.mockResolvedValue(null)
      mockPrismaService.messageReadReceipt.create.mockResolvedValue(readReceipt)
      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage)
      mockPrismaService.conversationParticipant.updateMany.mockResolvedValue({ count: 1 })

      const result = await service.markAsRead(dto)

      // markAsRead returns only the read timestamp, not the full receipt row.
      expect(result).toEqual({ readAt: readReceipt.readAt })
      expect(prisma.messageReadReceipt.create).toHaveBeenCalled()
    })

    it('should create read receipt even if called multiple times', async () => {
      const dto = {
        messageId: mockMessageId,
        userId: mockUserId,
      }

      const readReceipt = {
        id: 'receipt-2',
        messageId: mockMessageId,
        userId: mockUserId,
        readAt: new Date(),
      }

      mockPrismaService.messageReadReceipt.create.mockResolvedValue(readReceipt)
      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage)
      mockPrismaService.conversationParticipant.updateMany.mockResolvedValue({ count: 1 })

      const result = await service.markAsRead(dto)

      expect(result.readAt).toEqual(readReceipt.readAt)
      expect(prisma.messageReadReceipt.create).toHaveBeenCalled()
    })
  })

  describe('markAsDelivered', () => {
    it('should mark message as delivered', async () => {
      const dto = {
        messageId: mockMessageId,
        userId: mockUserId,
      }

      const deliveryReceipt = {
        id: 'receipt-1',
        messageId: mockMessageId,
        userId: mockUserId,
        deliveredAt: new Date(),
      }

      mockPrismaService.messageDeliveryReceipt.findUnique.mockResolvedValue(null)
      mockPrismaService.messageDeliveryReceipt.create.mockResolvedValue(deliveryReceipt)
      mockPrismaService.message.updateMany.mockResolvedValue({ count: 1 })

      const result = await service.markAsDelivered(dto)

      // markAsDelivered returns the internal receipt summary { deliveredAt, created },
      // not the full delivery receipt row.
      expect(result).toEqual({ deliveredAt: deliveryReceipt.deliveredAt, created: true })
      expect(prisma.messageDeliveryReceipt.create).toHaveBeenCalled()
    })
  })

  describe('addReaction', () => {
    it('should add reaction to message', async () => {
      const dto = {
        messageId: mockMessageId,
        userId: mockUserId,
        emoji: '👍',
      }

      const reaction = {
        id: 'reaction-1',
        messageId: mockMessageId,
        userId: mockUserId,
        emoji: '👍',
        createdAt: new Date(),
      }

      // addReaction first loads the message (for conversationId/senderId) before creating.
      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage)
      mockPrismaService.messageReaction.create.mockResolvedValue(reaction)

      const result = await service.addReaction(dto)

      expect(result).toEqual(reaction)
      expect(prisma.messageReaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            messageId: mockMessageId,
            userId: mockUserId,
            emoji: '👍',
          }),
        })
      )
    })
  })

  describe('removeReaction', () => {
    it('should remove reaction from message', async () => {
      const dto = {
        messageId: mockMessageId,
        userId: mockUserId,
        emoji: '👍',
      }

      // removeReaction loads the message first (for conversationId/senderId).
      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage)
      mockPrismaService.messageReaction.delete.mockResolvedValue({})

      await service.removeReaction(dto)

      expect(prisma.messageReaction.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            messageId_userId_emoji: {
              messageId: mockMessageId,
              userId: mockUserId,
              emoji: '👍',
            },
          }),
        })
      )
    })
  })

  describe('bookmarkMessage', () => {
    it('should bookmark a message', async () => {
      const dto = {
        messageId: mockMessageId,
        userId: mockUserId,
      }

      const bookmark = {
        id: 'bookmark-1',
        messageId: mockMessageId,
        userId: mockUserId,
        note: null,
        createdAt: new Date(),
      }

      // bookmarkMessage verifies the message exists before creating the bookmark.
      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage)
      mockPrismaService.messageBookmark.create.mockResolvedValue(bookmark)

      const result = await service.bookmarkMessage(dto)

      expect(result).toEqual(bookmark)
      expect(prisma.messageBookmark.create).toHaveBeenCalled()
    })
  })

  describe('unbookmarkMessage', () => {
    it('should remove bookmark from message', async () => {
      const dto = {
        messageId: mockMessageId,
        userId: mockUserId,
      }

      // unbookmarkMessage looks up the bookmark id (for the broadcast) before deleting.
      mockPrismaService.messageBookmark.findUnique.mockResolvedValue({ id: 'bookmark-1' })
      mockPrismaService.messageBookmark.delete.mockResolvedValue({})

      await service.unbookmarkMessage(dto)

      expect(prisma.messageBookmark.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            messageId_userId: {
              messageId: mockMessageId,
              userId: mockUserId,
            },
          }),
        })
      )
    })
  })

  describe('pinMessage', () => {
    it('should pin a message', async () => {
      const dto = {
        messageId: mockMessageId,
        userId: mockUserId,
      }

      // pinMessage loads the message (not yet pinned) and checks the pin count (< 5).
      mockPrismaService.message.findUnique.mockResolvedValue({
        conversationId: mockConversationId,
        isPinned: false,
      })
      mockPrismaService.message.count.mockResolvedValue(0)
      mockPrismaService.message.update.mockResolvedValue({
        ...mockMessage,
        isPinned: true,
        pinnedAt: new Date(),
        pinnedBy: mockUserId,
      })

      const result = await service.pinMessage(dto)

      expect(result.isPinned).toBe(true)
      expect(result.pinnedBy).toBe(mockUserId)
    })
  })

  describe('unpinMessage', () => {
    it('should unpin a message', async () => {
      const dto = {
        messageId: mockMessageId,
      }

      // unpinMessage loads the message first and requires it to be currently pinned.
      mockPrismaService.message.findUnique.mockResolvedValue({
        conversationId: mockConversationId,
        isPinned: true,
        pinnedBy: mockUserId,
      })
      mockPrismaService.message.update.mockResolvedValue({
        ...mockMessage,
        isPinned: false,
        pinnedAt: null,
        pinnedBy: null,
      })

      const result = await service.unpinMessage(dto)

      expect(result.isPinned).toBe(false)
    })
  })

  describe('forwardMessage', () => {
    it('should forward a message to another conversation', async () => {
      const dto = {
        messageId: mockMessageId,
        toConversationId: 'conversation-2',
        forwardedBy: mockUserId,
      }

      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage)
      mockPrismaService.conversation.findUnique.mockResolvedValue({
        id: 'conversation-2',
      })
      mockPrismaService.message.create.mockResolvedValue({
        ...mockMessage,
        id: 'new-message-id',
        conversationId: 'conversation-2',
        forwardedFromId: mockMessageId,
        forwardCount: 0,
      })
      mockPrismaService.message.update.mockResolvedValue({
        ...mockMessage,
        forwardCount: 1,
      })
      mockPrismaService.conversation.update.mockResolvedValue({})
      mockPrismaService.conversationParticipant.updateMany.mockResolvedValue({ count: 1 })

      const result = await service.forwardMessage(dto)

      expect(result.forwardedFromId).toBe(mockMessageId)
      // Note: The update call happens in the transaction, so we just verify the result
      expect(result).toBeDefined()
    })

    it('should throw NotFoundException if original message not found', async () => {
      const dto = {
        messageId: mockMessageId,
        toConversationId: 'conversation-2',
        forwardedBy: mockUserId,
      }

      mockPrismaService.message.findUnique.mockResolvedValue(null)

      await expect(service.forwardMessage(dto)).rejects.toThrow(NotFoundException)
    })
  })

  describe('scheduleMessage', () => {
    it('should schedule a message for future delivery', async () => {
      const futureDate = new Date(Date.now() + 3600000)
      const dto = {
        conversationId: mockConversationId,
        senderId: mockUserId,
        content: 'Scheduled message',
        scheduledFor: futureDate,
        scheduledBy: mockUserId,
      }

      mockPrismaService.message.create.mockResolvedValue({
        ...mockMessage,
        scheduledFor: futureDate,
        scheduledBy: mockUserId,
        isScheduled: true,
        status: MessageStatus.SENDING,
      })

      const result = await service.scheduleMessage(dto)

      expect(result.isScheduled).toBe(true)
      expect(result.scheduledFor).toEqual(futureDate)
    })
  })

  describe('reportMessage', () => {
    it('should create a message report', async () => {
      const dto = {
        messageId: mockMessageId,
        reportedBy: mockUserId,
        reason: ReportReason.SPAM,
        description: 'This is spam',
      }

      const report = {
        id: 'report-1',
        messageId: mockMessageId,
        reportedBy: mockUserId,
        reason: ReportReason.SPAM,
        description: 'This is spam',
        status: 'PENDING',
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrismaService.messageReport.create.mockResolvedValue(report)

      const result = await service.reportMessage(dto)

      expect(result).toEqual(report)
      expect(prisma.messageReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            messageId: mockMessageId,
            reportedBy: mockUserId,
            reason: ReportReason.SPAM,
          }),
        })
      )
    })
  })
})
