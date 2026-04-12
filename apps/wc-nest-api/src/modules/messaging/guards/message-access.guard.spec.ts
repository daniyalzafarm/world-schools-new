import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { MessageAccessGuard } from './message-access.guard'
import { PrismaService } from '../../../prisma/prisma.service'

describe('MessageAccessGuard', () => {
  let guard: MessageAccessGuard

  const USER_ID = 'user-aaa'
  const MSG_ID = 'msg-bbb'
  const CONV_ID = 'conv-ccc'

  const mockPrisma: any = {
    message: {
      findUnique: jest.fn(),
    },
    conversationParticipant: {
      findFirst: jest.fn(),
    },
  }

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
      providers: [MessageAccessGuard, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()

    guard = module.get<MessageAccessGuard>(MessageAccessGuard)
    jest.clearAllMocks()
  })

  describe('conversation participant — allowed', () => {
    it('returns true when user is a participant in the message conversation', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({ id: MSG_ID, conversationId: CONV_ID })
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({ id: 'p-1' })

      const ctx = buildContext(USER_ID, { id: MSG_ID })
      await expect(guard.canActivate(ctx)).resolves.toBe(true)
      expect(mockPrisma.conversationParticipant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ conversationId: CONV_ID, userId: USER_ID }),
        })
      )
    })

    it('accepts messageId param alias', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({ id: MSG_ID, conversationId: CONV_ID })
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({ id: 'p-1' })

      const ctx = buildContext(USER_ID, { messageId: MSG_ID })
      await expect(guard.canActivate(ctx)).resolves.toBe(true)
    })
  })

  describe('non-participant — 403', () => {
    it('throws ForbiddenException when user is not a participant', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({ id: MSG_ID, conversationId: CONV_ID })
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null)

      const ctx = buildContext(USER_ID, { id: MSG_ID })
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException)
    })
  })

  describe('message not found — 404', () => {
    it('throws NotFoundException when message does not exist', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null)

      const ctx = buildContext(USER_ID, { id: MSG_ID })
      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException)
    })
  })

  describe('edge cases', () => {
    it('returns true immediately when no user is present', async () => {
      const ctx = buildContext(undefined, { id: MSG_ID })
      await expect(guard.canActivate(ctx)).resolves.toBe(true)
      expect(mockPrisma.message.findUnique).not.toHaveBeenCalled()
    })

    it('returns true immediately when no messageId is in params', async () => {
      const ctx = buildContext(USER_ID, {})
      await expect(guard.canActivate(ctx)).resolves.toBe(true)
      expect(mockPrisma.message.findUnique).not.toHaveBeenCalled()
    })
  })
})
