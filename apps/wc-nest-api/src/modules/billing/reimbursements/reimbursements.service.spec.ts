import { NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { Prisma } from '../../../generated/client/client'
import { ReimbursementStatus } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { ReimbursementsService } from './reimbursements.service'

describe('ReimbursementsService', () => {
  let service: ReimbursementsService
  let prisma: any

  beforeEach(async () => {
    prisma = {
      reimbursement: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReimbursementsService, { provide: PrismaService, useValue: prisma }],
    }).compile()
    service = module.get(ReimbursementsService)
  })

  describe('createIfNeeded', () => {
    it('creates a row with a 7-day deadline when none exists for the refund', async () => {
      prisma.reimbursement.findFirst.mockResolvedValueOnce(null)
      prisma.reimbursement.create.mockImplementation(async ({ data }: any) => ({
        id: 'rb-1',
        ...data,
      }))

      const before = Date.now()
      const created = await service.createIfNeeded({
        bookingGroupId: 'bg-1',
        refundId: 'r-1',
        amountOwed: '600.00',
        currency: 'eur',
      })

      expect(created).toMatchObject({ status: ReimbursementStatus.pending })
      const dueDateMs = (created.dueDate as Date).getTime()
      expect(dueDateMs).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000 - 1000)
      expect(dueDateMs).toBeLessThanOrEqual(Date.now() + 7 * 24 * 60 * 60 * 1000 + 1000)
    })

    it('returns the existing row instead of duplicating', async () => {
      prisma.reimbursement.findFirst.mockResolvedValueOnce({ id: 'rb-existing' })
      const created = await service.createIfNeeded({
        bookingGroupId: 'bg-1',
        refundId: 'r-1',
        amountOwed: '600.00',
        currency: 'eur',
      })
      expect(created).toMatchObject({ id: 'rb-existing' })
      expect(prisma.reimbursement.create).not.toHaveBeenCalled()
    })

    it('accepts Prisma.Decimal for amountOwed', async () => {
      prisma.reimbursement.findFirst.mockResolvedValueOnce(null)
      prisma.reimbursement.create.mockImplementation(async ({ data }: any) => ({
        id: 'rb-1',
        ...data,
      }))

      const result = await service.createIfNeeded({
        bookingGroupId: 'bg-1',
        refundId: 'r-1',
        amountOwed: new Prisma.Decimal('1234.56'),
        currency: 'eur',
      })
      expect(result.amountOwed).toBeInstanceOf(Prisma.Decimal)
    })
  })

  describe('markSettled', () => {
    it('flips status to settled with admin user id', async () => {
      prisma.reimbursement.findUnique.mockResolvedValueOnce({
        id: 'rb-1',
        status: ReimbursementStatus.pending,
      })
      prisma.reimbursement.update.mockImplementation(async ({ data }: any) => ({
        id: 'rb-1',
        ...data,
      }))

      const result = await service.markSettled({ reimbursementId: 'rb-1', adminUserId: 'u-1' })

      expect(result).toMatchObject({
        status: ReimbursementStatus.settled,
        settledByUserId: 'u-1',
      })
    })

    it('is idempotent — returns same row when already settled', async () => {
      prisma.reimbursement.findUnique.mockResolvedValueOnce({
        id: 'rb-1',
        status: ReimbursementStatus.settled,
      })
      const result = await service.markSettled({ reimbursementId: 'rb-1', adminUserId: 'u-1' })
      expect(result).toMatchObject({ id: 'rb-1', status: ReimbursementStatus.settled })
      expect(prisma.reimbursement.update).not.toHaveBeenCalled()
    })

    it('throws NotFoundException when the reimbursement does not exist', async () => {
      prisma.reimbursement.findUnique.mockResolvedValueOnce(null)
      await expect(
        service.markSettled({ reimbursementId: 'rb-missing', adminUserId: 'u-1' })
      ).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('findOverdueForReminder', () => {
    it('queries pending reimbursements past dueDate with cooldown on lastReminderSentAt', async () => {
      prisma.reimbursement.findMany.mockResolvedValueOnce([])
      const now = new Date('2026-04-28T12:00:00Z')
      await service.findOverdueForReminder(now)

      const [call] = prisma.reimbursement.findMany.mock.calls
      expect(call[0].where).toMatchObject({
        status: ReimbursementStatus.pending,
        dueDate: { lt: now },
      })
      expect(call[0].where.OR).toEqual([
        { lastReminderSentAt: null },
        { lastReminderSentAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      ])
    })
  })
})
