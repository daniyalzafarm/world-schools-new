import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../../../../prisma/prisma.service'
import { RedisService } from '../../../redis/redis.service'
import { PayoutsService } from '../payouts.service'
import { PayoutReleaseCron } from './payout-release.cron'

describe('PayoutReleaseCron', () => {
  let cron: PayoutReleaseCron
  let prisma: any
  let redis: any
  let redisClient: any
  let payouts: any

  beforeEach(async () => {
    redisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    }
    redis = { getClient: () => redisClient }
    prisma = {
      bookingPayoutSchedule: {
        findMany: jest.fn(),
      },
    }
    payouts = {
      releasePendingTranche: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutReleaseCron,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: PayoutsService, useValue: payouts },
      ],
    }).compile()
    cron = module.get(PayoutReleaseCron)
  })

  describe('Redis lock', () => {
    it('skips when the lock is already held by another instance', async () => {
      redisClient.set.mockResolvedValueOnce(null) // SET NX returns null when key exists

      await cron.run()

      expect(prisma.bookingPayoutSchedule.findMany).not.toHaveBeenCalled()
      expect(redisClient.del).not.toHaveBeenCalled()
    })

    it('releases the lock even if the batch throws', async () => {
      prisma.bookingPayoutSchedule.findMany.mockRejectedValueOnce(new Error('db down'))

      await expect(cron.run()).rejects.toThrow('db down')
      expect(redisClient.del).toHaveBeenCalledWith('cron:lock:payout-release')
    })
  })

  describe('runBatch', () => {
    it('returns zeros when no due tranches exist', async () => {
      prisma.bookingPayoutSchedule.findMany.mockResolvedValueOnce([])

      const result = await cron.runBatch()

      expect(result).toEqual({ processed: 0, released: 0, skipped: 0 })
      expect(payouts.releasePendingTranche).not.toHaveBeenCalled()
    })

    it('queries pending tranches with releaseAt <= now, ordered by releaseAt asc', async () => {
      prisma.bookingPayoutSchedule.findMany.mockResolvedValueOnce([])

      await cron.runBatch()

      const args = prisma.bookingPayoutSchedule.findMany.mock.calls[0][0]
      expect(args.where).toMatchObject({
        status: 'pending',
        releaseAt: { lte: expect.any(Date) },
      })
      expect(args.orderBy).toEqual({ releaseAt: 'asc' })
    })

    it('counts a tranche that was released', async () => {
      prisma.bookingPayoutSchedule.findMany.mockResolvedValueOnce([{ id: 't-1' }])
      payouts.releasePendingTranche.mockResolvedValueOnce({
        stripePayoutId: 'po_1',
        skipped: false,
      })

      const result = await cron.runBatch()

      expect(payouts.releasePendingTranche).toHaveBeenCalledWith('t-1')
      expect(result).toEqual({ processed: 1, released: 1, skipped: 0 })
    })

    it('counts a tranche that was skipped (e.g., no funds available)', async () => {
      prisma.bookingPayoutSchedule.findMany.mockResolvedValueOnce([{ id: 't-skip' }])
      payouts.releasePendingTranche.mockResolvedValueOnce({
        stripePayoutId: null,
        skipped: true,
        reason: 'no_funds_available',
      })

      const result = await cron.runBatch()

      expect(result).toEqual({ processed: 1, released: 0, skipped: 1 })
    })

    it('continues the batch when one tranche throws', async () => {
      prisma.bookingPayoutSchedule.findMany.mockResolvedValueOnce([{ id: 't-a' }, { id: 't-b' }])
      payouts.releasePendingTranche
        .mockRejectedValueOnce(new Error('Stripe down'))
        .mockResolvedValueOnce({ stripePayoutId: 'po_b', skipped: false })

      const result = await cron.runBatch()

      expect(payouts.releasePendingTranche).toHaveBeenCalledTimes(2)
      expect(result).toMatchObject({ processed: 2, released: 1 })
    })
  })
})
