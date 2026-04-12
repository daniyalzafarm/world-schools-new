import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { ConversationAccessGuard } from './conversation-access.guard'
import { PrismaService } from '../../../prisma/prisma.service'
import { ConversationsService } from '../services/conversations.service'
import { ConversationType } from '../../../generated/client/client'

describe('ConversationAccessGuard', () => {
  let guard: ConversationAccessGuard

  const USER_ID = 'user-aaa'
  const CONV_ID = 'conv-bbb'
  const PROVIDER_ID = 'prov-ccc'

  const mockPrisma: any = {
    conversation: {
      findUnique: jest.fn(),
    },
    conversationParticipant: {
      findFirst: jest.fn(),
    },
  }

  const mockConversationsService: any = {
    getProviderIdForUser: jest.fn(),
  }

  /** Build an ExecutionContext stub for a given user and params */
  const buildContext = (
    userId: string | undefined,
    params: Record<string, string>
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: userId ? { id: userId } : undefined,
          params,
        }),
      }),
    }) as unknown as ExecutionContext

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationAccessGuard,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConversationsService, useValue: mockConversationsService },
      ],
    }).compile()

    guard = module.get<ConversationAccessGuard>(ConversationAccessGuard)
    jest.clearAllMocks()
  })

  describe('direct participant — allowed', () => {
    it('returns true when user is a direct participant', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: CONV_ID,
        type: ConversationType.USER_PROVIDER,
        metadata: { providerId: 'other-provider' },
      })
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({ id: 'p-1' })

      const ctx = buildContext(USER_ID, { id: CONV_ID })
      await expect(guard.canActivate(ctx)).resolves.toBe(true)
      expect(mockPrisma.conversationParticipant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ conversationId: CONV_ID, userId: USER_ID }),
        })
      )
    })
  })

  describe('non-participant, different org — 403', () => {
    it('throws ForbiddenException when user is not a participant and provider does not match', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: CONV_ID,
        type: ConversationType.USER_PROVIDER,
        metadata: { providerId: PROVIDER_ID },
      })
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null)
      mockConversationsService.getProviderIdForUser.mockResolvedValue('prov-different')

      const ctx = buildContext(USER_ID, { id: CONV_ID })
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException)
    })
  })

  describe('provider-org member, same providerId — allowed', () => {
    it('returns true when user belongs to the same provider org as the conversation', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: CONV_ID,
        type: ConversationType.USER_PROVIDER,
        metadata: { providerId: PROVIDER_ID },
      })
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null)
      mockConversationsService.getProviderIdForUser.mockResolvedValue(PROVIDER_ID)

      const ctx = buildContext(USER_ID, { conversationId: CONV_ID })
      await expect(guard.canActivate(ctx)).resolves.toBe(true)
    })
  })

  describe('provider-org member, different providerId — 403', () => {
    it('throws ForbiddenException when provider IDs do not match', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: CONV_ID,
        type: ConversationType.USER_PROVIDER,
        metadata: { providerId: PROVIDER_ID },
      })
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null)
      mockConversationsService.getProviderIdForUser.mockResolvedValue('prov-zzz')

      const ctx = buildContext(USER_ID, { id: CONV_ID })
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException)
    })
  })

  describe('conversation not found — 404', () => {
    it('throws NotFoundException when the conversation does not exist', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(null)

      const ctx = buildContext(USER_ID, { id: CONV_ID })
      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException)
    })
  })

  describe('edge cases', () => {
    it('returns true immediately when no user is present (JWT guard handles auth)', async () => {
      const ctx = buildContext(undefined, { id: CONV_ID })
      await expect(guard.canActivate(ctx)).resolves.toBe(true)
      expect(mockPrisma.conversation.findUnique).not.toHaveBeenCalled()
    })

    it('returns true immediately when no conversationId is in params', async () => {
      const ctx = buildContext(USER_ID, {})
      await expect(guard.canActivate(ctx)).resolves.toBe(true)
      expect(mockPrisma.conversation.findUnique).not.toHaveBeenCalled()
    })
  })
})
