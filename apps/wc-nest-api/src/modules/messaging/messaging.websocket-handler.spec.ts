import { Test, TestingModule } from '@nestjs/testing'
import { MessagingWebSocketHandler } from './messaging.websocket-handler'
import { WebSocketService } from '../websocket/websocket.service'
import { MessagesService } from './services/messages.service'
import { ConversationsService } from './services/conversations.service'
import { TypingService } from './services/typing.service'
import { PresenceService } from './services/presence.service'
import { PrismaService } from '../../prisma/prisma.service'
import { RedisPubSubService } from './services/redis-pub-sub.service'
import { RedisService } from '../redis/redis.service'

describe('MessagingWebSocketHandler — security checks', () => {
  let handler: MessagingWebSocketHandler

  const USER_ID = 'user-aaa'
  const OTHER_USER_ID = 'user-zzz'
  const CONV_ID = 'conv-bbb'
  const MSG_ID = 'msg-ccc'
  const PROVIDER_ID = 'prov-ddd'

  const mockWsService: any = {
    joinRoom: jest.fn(),
    leaveRoom: jest.fn(),
    emitToRoom: jest.fn(),
  }

  const mockMessagesService: any = {
    markAsRead: jest.fn(),
    markAsDelivered: jest.fn(),
    createMessageViaWebSocket: jest.fn(),
  }

  const mockConversationsService: any = {
    getProviderIdForUser: jest.fn(),
  }

  const mockTypingService: any = {
    setTyping: jest.fn(),
    clearTyping: jest.fn(),
  }

  const mockPresenceService: any = {
    addPresenceSubscription: jest.fn().mockResolvedValue(undefined),
    removePresenceSubscriptions: jest.fn(),
  }

  const mockPrisma: any = {
    conversationParticipant: {
      findFirst: jest.fn(),
    },
    conversation: {
      findUnique: jest.fn(),
    },
  }

  const mockRedisPubSub: any = {
    publish: jest.fn(),
  }

  const mockRedisService: any = {
    // `null` = cache miss, so canAccessConversation computes the result fresh.
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    getClient: jest.fn().mockReturnValue({ set: jest.fn(), del: jest.fn() }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingWebSocketHandler,
        { provide: WebSocketService, useValue: mockWsService },
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: ConversationsService, useValue: mockConversationsService },
        { provide: TypingService, useValue: mockTypingService },
        { provide: PresenceService, useValue: mockPresenceService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisPubSubService, useValue: mockRedisPubSub },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile()

    handler = module.get<MessagingWebSocketHandler>(MessagingWebSocketHandler)
    jest.clearAllMocks()
  })

  // ─── join_conversation ────────────────────────────────────────────────────

  describe('handleJoinConversation', () => {
    it('calls wsService.joinRoom when user IS a participant', async () => {
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({ id: 'p-1' })
      // Stub the follow-up presence query
      mockPrisma.conversation.findUnique.mockResolvedValue({
        participants: [{ userId: USER_ID }, { userId: OTHER_USER_ID }],
      })

      await handler.handleJoinConversation({ userId: USER_ID, conversationId: CONV_ID })

      expect(mockWsService.joinRoom).toHaveBeenCalledWith(USER_ID, `conversation:${CONV_ID}`)
    })

    it('does NOT call wsService.joinRoom when user is NOT a participant', async () => {
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null)
      mockPrisma.conversation.findUnique.mockResolvedValue({
        type: 'USER_SUPERADMIN',
        metadata: null,
      })

      await handler.handleJoinConversation({ userId: USER_ID, conversationId: CONV_ID })

      expect(mockWsService.joinRoom).not.toHaveBeenCalled()
    })

    it('does NOT call wsService.joinRoom when provider IDs do not match', async () => {
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null)
      mockPrisma.conversation.findUnique.mockResolvedValue({
        type: 'USER_PROVIDER',
        metadata: { providerId: PROVIDER_ID },
      })
      mockConversationsService.getProviderIdForUser.mockResolvedValue('prov-different')

      await handler.handleJoinConversation({ userId: USER_ID, conversationId: CONV_ID })

      expect(mockWsService.joinRoom).not.toHaveBeenCalled()
    })

    it('allows provider-org member to join a USER_PROVIDER conversation', async () => {
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null)
      mockPrisma.conversation.findUnique
        // First call: canAccessConversation
        .mockResolvedValueOnce({ type: 'USER_PROVIDER', metadata: { providerId: PROVIDER_ID } })
        // Second call: presence subscription setup
        .mockResolvedValueOnce({ participants: [{ userId: OTHER_USER_ID }] })
      mockConversationsService.getProviderIdForUser.mockResolvedValue(PROVIDER_ID)

      await handler.handleJoinConversation({ userId: USER_ID, conversationId: CONV_ID })

      expect(mockWsService.joinRoom).toHaveBeenCalledWith(USER_ID, `conversation:${CONV_ID}`)
    })
  })

  // ─── message:read ─────────────────────────────────────────────────────────

  describe('handleMessageRead', () => {
    it('does NOT call messagesService.markAsRead when user is NOT a participant', async () => {
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null)
      mockPrisma.conversation.findUnique.mockResolvedValue({
        type: 'USER_SUPERADMIN',
        metadata: null,
      })

      await handler.handleMessageRead({
        userId: USER_ID,
        messageId: MSG_ID,
        conversationId: CONV_ID,
      })

      expect(mockMessagesService.markAsRead).not.toHaveBeenCalled()
      expect(mockWsService.emitToRoom).not.toHaveBeenCalled()
    })

    it('calls markAsRead when user IS a participant', async () => {
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({ id: 'p-1' })
      mockMessagesService.markAsRead.mockResolvedValue(undefined)

      await handler.handleMessageRead({
        userId: USER_ID,
        messageId: MSG_ID,
        conversationId: CONV_ID,
      })

      expect(mockMessagesService.markAsRead).toHaveBeenCalledWith(
        expect.objectContaining({ messageId: MSG_ID, userId: USER_ID })
      )
      // The receipt broadcast is emitted by Redis pub/sub inside markAsRead(),
      // not by the handler — see messages.service.spec for that assertion.
    })
  })

  // ─── message:delivered ───────────────────────────────────────────────────

  describe('handleMessageDelivered', () => {
    it('does NOT call messagesService.markAsDelivered when user is NOT a participant', async () => {
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null)
      mockPrisma.conversation.findUnique.mockResolvedValue({
        type: 'USER_SUPERADMIN',
        metadata: null,
      })

      await handler.handleMessageDelivered({
        userId: USER_ID,
        messageId: MSG_ID,
        conversationId: CONV_ID,
      })

      expect(mockMessagesService.markAsDelivered).not.toHaveBeenCalled()
      expect(mockWsService.emitToRoom).not.toHaveBeenCalled()
    })

    it('calls markAsDelivered and emits receipt when user IS a participant', async () => {
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({ id: 'p-1' })
      mockMessagesService.markAsDelivered.mockResolvedValue(undefined)

      await handler.handleMessageDelivered({
        userId: USER_ID,
        messageId: MSG_ID,
        conversationId: CONV_ID,
        deliveryLatencyMs: 42,
      })

      expect(mockMessagesService.markAsDelivered).toHaveBeenCalledWith(
        expect.objectContaining({ messageId: MSG_ID, userId: USER_ID })
      )
    })
  })
})
