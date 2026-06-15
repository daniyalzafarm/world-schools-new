import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ProviderReviewStatus, ProviderSuspensionCategory } from '../../../generated/client/enums'
import { ProviderAdminReviewQueueService } from './provider-admin-review.service'

describe('ProviderAdminReviewQueueService', () => {
  let prisma: any
  let service: ProviderAdminReviewQueueService

  beforeEach(() => {
    prisma = {
      providerAdminReviewQueue: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    }
    service = new ProviderAdminReviewQueueService(prisma)
  })

  describe('enqueue', () => {
    const input = {
      providerId: 'prov-1',
      suspensionType: ProviderSuspensionCategory.precautionary,
      reasonText: 'Provider cancelled booking bg-1',
      affectedBookingCount: 1,
    }

    it('creates a pending review when no open one exists', async () => {
      prisma.providerAdminReviewQueue.findFirst.mockResolvedValueOnce(null)
      prisma.providerAdminReviewQueue.create.mockResolvedValueOnce({ id: 'rev-1' })

      await service.enqueue(input)

      expect(prisma.providerAdminReviewQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            providerId: 'prov-1',
            suspensionType: ProviderSuspensionCategory.precautionary,
            status: ProviderReviewStatus.pending,
            affectedBookingCount: 1,
          }),
        })
      )
    })

    it('is idempotent per (provider, type): bumps the tally on an existing open review instead of stacking', async () => {
      prisma.providerAdminReviewQueue.findFirst.mockResolvedValueOnce({
        id: 'rev-open',
        affectedBookingCount: 2,
      })
      prisma.providerAdminReviewQueue.update.mockResolvedValueOnce({
        id: 'rev-open',
        affectedBookingCount: 3,
      })

      await service.enqueue(input)

      expect(prisma.providerAdminReviewQueue.create).not.toHaveBeenCalled()
      expect(prisma.providerAdminReviewQueue.update).toHaveBeenCalledWith({
        where: { id: 'rev-open' },
        data: { affectedBookingCount: 3 },
      })
      // The open-review lookup only matches non-terminal statuses.
      const where = prisma.providerAdminReviewQueue.findFirst.mock.calls[0][0].where
      expect(where.status.in).toEqual([
        ProviderReviewStatus.pending,
        ProviderReviewStatus.under_review,
      ])
    })
  })

  describe('enqueueSafe', () => {
    it('swallows errors so a logging failure never breaks the caller', async () => {
      prisma.providerAdminReviewQueue.findFirst.mockRejectedValueOnce(new Error('db down'))
      await expect(
        service.enqueueSafe({
          providerId: 'prov-1',
          suspensionType: ProviderSuspensionCategory.precautionary,
          reasonText: 'x',
        })
      ).resolves.toBeUndefined()
    })
  })

  describe('resolve', () => {
    it('closes a pending review with a decision + reviewer + timestamp', async () => {
      prisma.providerAdminReviewQueue.findUnique.mockResolvedValueOnce({
        id: 'rev-1',
        status: ProviderReviewStatus.pending,
        reviewedAt: null,
        decision: null,
        decisionNotes: null,
      })
      prisma.providerAdminReviewQueue.update.mockResolvedValueOnce({ id: 'rev-1' })

      await service.resolve('rev-1', {
        reviewedByUserId: 'admin-1',
        status: ProviderReviewStatus.resolved,
        decision: 'cleared',
        decisionNotes: 'no further action',
      })

      const data = prisma.providerAdminReviewQueue.update.mock.calls[0][0].data
      expect(data.status).toBe(ProviderReviewStatus.resolved)
      expect(data.reviewedByUserId).toBe('admin-1')
      expect(data.decision).toBe('cleared')
      expect(data.reviewedAt).toBeInstanceOf(Date)
    })

    it('rejects resolving an already-resolved review', async () => {
      prisma.providerAdminReviewQueue.findUnique.mockResolvedValueOnce({
        id: 'rev-1',
        status: ProviderReviewStatus.resolved,
      })
      await expect(
        service.resolve('rev-1', {
          reviewedByUserId: 'admin-1',
          status: ProviderReviewStatus.resolved,
        })
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('throws NotFound for an unknown review id', async () => {
      prisma.providerAdminReviewQueue.findUnique.mockResolvedValueOnce(null)
      await expect(
        service.resolve('nope', {
          reviewedByUserId: 'admin-1',
          status: ProviderReviewStatus.under_review,
        })
      ).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('list', () => {
    it('clamps the page size and filters by status when provided', async () => {
      prisma.providerAdminReviewQueue.findMany.mockResolvedValueOnce([{ id: 'rev-1' }])
      prisma.providerAdminReviewQueue.count.mockResolvedValueOnce(1)

      const res = await service.list({ status: ProviderReviewStatus.pending, limit: 999 })

      expect(res.total).toBe(1)
      expect(res.limit).toBe(100) // clamped
      const args = prisma.providerAdminReviewQueue.findMany.mock.calls[0][0]
      expect(args.where).toEqual({ status: ProviderReviewStatus.pending })
      expect(args.take).toBe(100)
    })
  })
})
