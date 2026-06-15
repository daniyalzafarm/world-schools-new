import { BadRequestException, NotFoundException } from '@nestjs/common'
import { PaymentReviewService } from './payment-review.service'

describe('PaymentReviewService', () => {
  let prisma: any
  let refunds: any
  let paymentIntents: any
  let audit: any
  let service: PaymentReviewService

  beforeEach(() => {
    prisma = {
      bookingGroup: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    }
    refunds = { cancelByCamp: jest.fn().mockResolvedValue({ mode: 'camp_cancel', refunds: [] }) }
    paymentIntents = { cancelForBookingGroup: jest.fn().mockResolvedValue(undefined) }
    audit = { appendSafe: jest.fn().mockResolvedValue(undefined) }
    service = new PaymentReviewService(prisma, refunds, paymentIntents, audit)
  })

  describe('list', () => {
    it('queries only OPEN reviews (flagged, not resolved) and clamps the page size', async () => {
      prisma.bookingGroup.findMany.mockResolvedValueOnce([{ id: 'bg-1' }])
      prisma.bookingGroup.count.mockResolvedValueOnce(1)

      const res = await service.list({ limit: 999 })

      expect(res.total).toBe(1)
      expect(res.limit).toBe(100) // clamped
      const where = prisma.bookingGroup.findMany.mock.calls[0][0].where
      expect(where.paymentReviewStatus).toEqual({ not: null })
      expect(where.paymentReviewResolvedAt).toBeNull()
    })
  })

  describe('resolve', () => {
    const open = {
      id: 'bg-1',
      paymentReviewStatus: 'capture_failed',
      paymentReviewResolvedAt: null,
    }

    it('cancel: refunds + cancels via cancelByCamp, stamps resolved, and audits admin_override', async () => {
      prisma.bookingGroup.findUnique
        .mockResolvedValueOnce(open) // pre-check
        .mockResolvedValueOnce({ id: 'bg-1', status: 'cancelled' }) // return value

      await service.resolve('bg-1', 'admin-1', { action: 'cancel', notes: 'uncollectable' })

      expect(refunds.cancelByCamp).toHaveBeenCalledWith(
        expect.objectContaining({ bookingGroupId: 'bg-1', adminUserId: 'admin-1' })
      )
      expect(prisma.bookingGroup.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bg-1', paymentReviewResolvedAt: null },
          data: expect.objectContaining({ paymentReviewResolvedByAdminId: 'admin-1' }),
        })
      )
      expect(audit.appendSafe).toHaveBeenCalledWith(
        expect.objectContaining({ bookingGroupId: 'bg-1', eventType: 'admin_override' })
      )
    })

    it('mark_resolved: stamps resolved + audits WITHOUT a money action', async () => {
      prisma.bookingGroup.findUnique
        .mockResolvedValueOnce(open)
        .mockResolvedValueOnce({ id: 'bg-1', status: 'payment_review' })

      await service.resolve('bg-1', 'admin-1', { action: 'mark_resolved' })

      expect(refunds.cancelByCamp).not.toHaveBeenCalled()
      expect(prisma.bookingGroup.updateMany).toHaveBeenCalled()
      expect(audit.appendSafe).toHaveBeenCalled()
    })

    it('rejects resolving a booking that is not in an open review', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce({
        id: 'bg-1',
        paymentReviewStatus: 'capture_failed',
        paymentReviewResolvedAt: new Date(),
      })
      await expect(service.resolve('bg-1', 'admin-1', { action: 'cancel' })).rejects.toBeInstanceOf(
        BadRequestException
      )
      expect(refunds.cancelByCamp).not.toHaveBeenCalled()
    })

    it('throws NotFound for an unknown booking', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(null)
      await expect(service.resolve('nope', 'admin-1', { action: 'cancel' })).rejects.toBeInstanceOf(
        NotFoundException
      )
    })
  })
})
