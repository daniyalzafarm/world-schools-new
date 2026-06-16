import { ForceMajeureService } from './force-majeure.service'

describe('ForceMajeureService', () => {
  let prisma: any
  let refunds: any
  let paymentIntents: any
  let service: ForceMajeureService

  const SCOPE = {
    dateFrom: new Date('2026-07-01T00:00:00Z'),
    dateTo: new Date('2026-07-31T00:00:00Z'),
  }

  beforeEach(() => {
    prisma = {
      bookingGroup: { count: jest.fn(), findMany: jest.fn() },
      forceMajeureEvent: {
        create: jest.fn().mockResolvedValue({ id: 'fm-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    }
    refunds = { cancelByForceMajeure: jest.fn() }
    paymentIntents = { cancelForBookingGroup: jest.fn().mockResolvedValue(undefined) }
    service = new ForceMajeureService(prisma, refunds, paymentIntents)
  })

  describe('preview', () => {
    it('counts active bookings in the programme window (excludes terminal statuses)', async () => {
      prisma.bookingGroup.count.mockResolvedValueOnce(7)

      const res = await service.preview({ ...SCOPE, providerId: 'prov-1' })

      expect(res.affectedBookingCount).toBe(7)
      const where = prisma.bookingGroup.count.mock.calls[0][0].where
      expect(where.status.notIn).toEqual(
        expect.arrayContaining(['cancelled', 'completed', 'fully_refunded'])
      )
      expect(where.session.startDate).toEqual({ gte: SCOPE.dateFrom, lte: SCOPE.dateTo })
      expect(where.providerId).toBe('prov-1')
    })
  })

  describe('execute', () => {
    it('creates a FM event, cancels each booking, tallies refunds + failures, and finalizes the event', async () => {
      prisma.bookingGroup.findMany.mockResolvedValueOnce([
        { id: 'bg-1' },
        { id: 'bg-2' },
        { id: 'bg-3' },
      ])
      refunds.cancelByForceMajeure
        .mockResolvedValueOnce({ mode: 'force_majeure_cash', refunds: [{ amount: '600.00' }] })
        .mockResolvedValueOnce({ mode: 'force_majeure_cash', refunds: [{ amount: '400.00' }] })
        .mockRejectedValueOnce(new Error('not cancelable'))

      const res = await service.execute('admin-1', 'Flood at venue', SCOPE)

      expect(res.eventId).toBe('fm-1')
      expect(res.cancelled).toBe(2)
      expect(res.failed).toBe(1)
      expect(res.totalRefunded).toBe('1000')
      // The event is finalized with the cancelled count + total refunded.
      expect(prisma.forceMajeureEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fm-1' },
          data: expect.objectContaining({ affectedBookingCount: 2, platformFeeRefunded: false }),
        })
      )
    })

    it('defaults to retaining the platform fee (no toggle passed)', async () => {
      prisma.bookingGroup.findMany.mockResolvedValueOnce([{ id: 'bg-1' }])
      refunds.cancelByForceMajeure.mockResolvedValueOnce({ refunds: [{ amount: '600.00' }] })

      await service.execute('admin-1', 'Storm', SCOPE)

      expect(refunds.cancelByForceMajeure).toHaveBeenCalledWith(
        expect.objectContaining({ refundPlatformFee: false })
      )
    })

    it('threads refundPlatformFee=true through to the refund + records it on the event', async () => {
      prisma.bookingGroup.findMany.mockResolvedValueOnce([{ id: 'bg-1' }])
      refunds.cancelByForceMajeure.mockResolvedValueOnce({ refunds: [{ amount: '600.00' }] })

      await service.execute('admin-1', 'Wildfire', SCOPE, true)

      expect(refunds.cancelByForceMajeure).toHaveBeenCalledWith(
        expect.objectContaining({ refundPlatformFee: true })
      )
      expect(prisma.forceMajeureEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ platformFeeRefunded: true }),
        })
      )
    })
  })
})
