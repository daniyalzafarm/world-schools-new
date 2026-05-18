import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '../../../../config/config.service'
import { BookingGroupStatus, PaymentStatus } from '../../../../generated/client/enums'
import { PrismaService } from '../../../../prisma/prisma.service'
import { RedisService } from '../../../redis/redis.service'
import { StripeService } from '../../../stripe/stripe.service'
import { AuthExpiryMonitorCron } from './auth-expiry-monitor.cron'

describe('AuthExpiryMonitorCron', () => {
  let cron: AuthExpiryMonitorCron
  let prisma: any
  let redis: any
  let stripeService: any
  let redisClient: any

  beforeEach(async () => {
    redisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    }
    redis = { getClient: () => redisClient }
    prisma = {
      payment: {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
      bookingGroup: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    }
    stripeService = {
      client: {
        paymentIntents: {
          cancel: jest.fn().mockResolvedValue({ id: 'pi_1', status: 'canceled' }),
        },
      },
    }

    const config = {
      billingConfig: {
        maxAttempts: 2,
        retryHours: 24,
        stepUpWindowHours: 48,
        cronIntervalMinutes: 30,
        authExpiryWarnDays: 5,
        authExpiryCancelDays: 6,
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthExpiryMonitorCron,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: StripeService, useValue: stripeService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile()
    cron = module.get(AuthExpiryMonitorCron)
  })

  describe('Redis lock', () => {
    it('skips the run when the lock is already held by another instance', async () => {
      redisClient.set.mockResolvedValueOnce(null) // SET NX returns null when key exists

      await cron.run()

      expect(prisma.payment.findMany).not.toHaveBeenCalled()
      expect(redisClient.del).not.toHaveBeenCalled()
    })

    it('releases the lock even if the batch throws', async () => {
      prisma.payment.findMany.mockRejectedValueOnce(new Error('db down'))

      await expect(cron.run()).rejects.toThrow('db down')
      expect(redisClient.del).toHaveBeenCalledWith('cron:lock:auth-expiry-monitor')
    })
  })

  describe('runBatch', () => {
    it('only picks up requires_capture rows past the cancel cutoff', async () => {
      // No candidates — drive the query to assert the WHERE shape.
      prisma.payment.findMany.mockResolvedValue([])

      await cron.runBatch()

      const cancelQuery = prisma.payment.findMany.mock.calls[0][0]
      expect(cancelQuery.where).toMatchObject({
        status: PaymentStatus.requires_capture,
        processingStartedAt: { lte: expect.any(Date) },
      })
      // Direct Charges: the cron now must SELECT `stripeAccountId` so the
      // cancel call can scope to the connected account.
      expect(cancelQuery.select).toMatchObject({
        id: true,
        bookingGroupId: true,
        stripePaymentIntentId: true,
        stripeAccountId: true,
      })
    })

    it('cancels a Stripe intent on the connected account with an idempotency key, then flips the local DB row', async () => {
      const now = Date.now()
      const dayMs = 24 * 60 * 60 * 1000
      prisma.payment.findMany
        .mockResolvedValueOnce([
          {
            id: 'pay-1',
            bookingGroupId: 'bg-1',
            stripePaymentIntentId: 'pi_1',
            stripeAccountId: 'acct_provider',
            processingStartedAt: new Date(now - 7 * dayMs), // past cutoff
          },
        ])
        // Warn pass returns nothing — the cancel pass already swept the row.
        .mockResolvedValueOnce([])

      const result = await cron.runBatch()

      expect(result.canceled).toBe(1)
      expect(result.warned).toBe(0)

      // Direct Charges: cancel passes `stripeAccount` + idempotencyKey.
      const [intentId, params, opts] = stripeService.client.paymentIntents.cancel.mock.calls[0]
      expect(intentId).toBe('pi_1')
      expect(params).toMatchObject({ cancellation_reason: 'abandoned' })
      expect(opts).toMatchObject({
        stripeAccount: 'acct_provider',
        idempotencyKey: expect.stringMatching(/^pi:cancel:pay-1:auth-expired:[0-9a-f]{16}$/),
      })

      // Local row flips to canceled with the auth_window_expired failure code.
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1' },
          data: expect.objectContaining({
            status: PaymentStatus.canceled,
            failureCode: 'auth_window_expired',
            processingStartedAt: null,
          }),
        })
      )
      // BookingGroup transition is gated to happy-path statuses.
      expect(prisma.bookingGroup.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'bg-1',
            status: { in: [BookingGroupStatus.request, BookingGroupStatus.accepted] },
          }),
          data: { status: BookingGroupStatus.expired },
        })
      )
    })

    it('falls back to local-only cleanup when stripeAccountId is missing (invariant violation)', async () => {
      const now = Date.now()
      const dayMs = 24 * 60 * 60 * 1000
      prisma.payment.findMany
        .mockResolvedValueOnce([
          {
            id: 'pay-1',
            bookingGroupId: 'bg-1',
            stripePaymentIntentId: 'pi_1',
            stripeAccountId: null, // shouldn't happen, but the cron defends.
            processingStartedAt: new Date(now - 7 * dayMs),
          },
        ])
        .mockResolvedValueOnce([])

      const result = await cron.runBatch()

      // We skip the Stripe call (we cannot scope it) but still cancel locally
      // so the booking advances out of the stuck state.
      expect(stripeService.client.paymentIntents.cancel).not.toHaveBeenCalled()
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.canceled }),
        })
      )
      expect(result.canceled).toBe(1)
    })

    it('swallows Stripe-side cancel failures and still flips the local row (idempotent on Stripe)', async () => {
      const now = Date.now()
      const dayMs = 24 * 60 * 60 * 1000
      prisma.payment.findMany
        .mockResolvedValueOnce([
          {
            id: 'pay-1',
            bookingGroupId: 'bg-1',
            stripePaymentIntentId: 'pi_1',
            stripeAccountId: 'acct_provider',
            processingStartedAt: new Date(now - 7 * dayMs),
          },
        ])
        .mockResolvedValueOnce([])
      stripeService.client.paymentIntents.cancel.mockRejectedValueOnce(
        new Error('already canceled on Stripe')
      )

      const result = await cron.runBatch()

      expect(result.canceled).toBe(1)
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.canceled }),
        })
      )
    })

    it('warns rows that are between the warn cutoff and cancel cutoff (no Stripe call, no local mutation)', async () => {
      const now = Date.now()
      const dayMs = 24 * 60 * 60 * 1000
      prisma.payment.findMany
        .mockResolvedValueOnce([]) // no cancel candidates
        .mockResolvedValueOnce([
          {
            id: 'pay-2',
            bookingGroupId: 'bg-2',
            processingStartedAt: new Date(now - 5 * dayMs),
          },
        ])

      const result = await cron.runBatch()

      expect(result.warned).toBe(1)
      expect(result.canceled).toBe(0)
      expect(stripeService.client.paymentIntents.cancel).not.toHaveBeenCalled()
      expect(prisma.payment.update).not.toHaveBeenCalled()
    })
  })
})
