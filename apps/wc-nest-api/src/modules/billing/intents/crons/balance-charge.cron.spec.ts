import { EventEmitter2 } from '@nestjs/event-emitter'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '../../../../config/config.service'
import { PaymentStatus } from '../../../../generated/client/enums'
import { PrismaService } from '../../../../prisma/prisma.service'
import { RedisService } from '../../../redis/redis.service'
import { BillingPaymentNotificationsService } from '../notifications/billing-payment-notifications.service'
import { PaymentIntentsService } from '../payment-intents.service'
import { BalanceChargeCron } from './balance-charge.cron'

describe('BalanceChargeCron', () => {
  let cron: BalanceChargeCron
  let prisma: any
  let redis: any
  let paymentIntents: any
  let notifications: any
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
        findUnique: jest.fn(),
      },
      bookingGroup: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    }
    paymentIntents = {
      chargeOffSession: jest.fn().mockResolvedValue(undefined),
    }
    notifications = {
      notifyOffSessionRequiresAction: jest.fn().mockResolvedValue(undefined),
      notifyPaymentFailedFinal: jest.fn().mockResolvedValue(undefined),
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
        BalanceChargeCron,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: PaymentIntentsService, useValue: paymentIntents },
        { provide: BillingPaymentNotificationsService, useValue: notifications },
        { provide: ConfigService, useValue: config },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile()
    cron = module.get(BalanceChargeCron)
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
      expect(redisClient.del).toHaveBeenCalledWith('cron:lock:balance-charge')
    })
  })

  describe('runBatch — initial pickup', () => {
    it('returns zeros when no payments are due', async () => {
      prisma.payment.findMany.mockResolvedValueOnce([])

      const result = await cron.runBatch()

      expect(result).toEqual({
        succeeded: 0,
        requiresAction: 0,
        failed: 0,
        exhausted: 0,
        stepUpAbandoned: 0,
      })
      expect(paymentIntents.chargeOffSession).not.toHaveBeenCalled()
    })

    it('counts a row that landed at status=succeeded after chargeOffSession', async () => {
      prisma.payment.findMany.mockResolvedValueOnce([{ id: 'pay-1' }])
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-1',
        status: PaymentStatus.succeeded,
        attemptCount: 1,
        bookingGroupId: 'bg-1',
      })

      const result = await cron.runBatch()

      expect(paymentIntents.chargeOffSession).toHaveBeenCalledWith('pay-1')
      expect(result).toMatchObject({ succeeded: 1, requiresAction: 0, failed: 0, exhausted: 0 })
      expect(prisma.bookingGroup.updateMany).not.toHaveBeenCalled()
    })

    it('counts a row that needs 3DS step-up (requires_action), sends recovery email, does NOT flip the BookingGroup', async () => {
      prisma.payment.findMany.mockResolvedValueOnce([{ id: 'pay-2' }])
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-2',
        status: PaymentStatus.requires_action,
        attemptCount: 1,
        bookingGroupId: 'bg-2',
      })

      const result = await cron.runBatch()

      expect(result).toMatchObject({ requiresAction: 1, exhausted: 0 })
      // BookingGroup must NOT be moved to payment_failed for requires_action
      // — the parent still has a chance to complete the challenge.
      expect(prisma.bookingGroup.updateMany).not.toHaveBeenCalled()
      // Recovery email is dispatched best-effort by the notifications service.
      expect(notifications.notifyOffSessionRequiresAction).toHaveBeenCalledWith('pay-2')
      expect(notifications.notifyPaymentFailedFinal).not.toHaveBeenCalled()
    })

    it('does not roll back the BookingGroup when a single failed retry leaves attemptCount<MAX', async () => {
      prisma.payment.findMany.mockResolvedValueOnce([{ id: 'pay-3' }])
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-3',
        status: PaymentStatus.failed,
        attemptCount: 1, // first decline → next retry scheduled
        bookingGroupId: 'bg-3',
      })

      const result = await cron.runBatch()

      expect(result).toMatchObject({ failed: 1, exhausted: 0 })
      expect(prisma.bookingGroup.updateMany).not.toHaveBeenCalled()
    })

    it('marks the BookingGroup payment_failed and sends final-failure email when a row exhausts the retry window', async () => {
      prisma.payment.findMany.mockResolvedValueOnce([{ id: 'pay-4' }])
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-4',
        status: PaymentStatus.failed,
        attemptCount: 2, // hit MAX_ATTEMPTS — final decline
        bookingGroupId: 'bg-4',
      })

      const result = await cron.runBatch()

      expect(result).toMatchObject({ failed: 1, exhausted: 1 })
      // Guarded with status: in [deposit_paid, accepted, request] so we
      // never overwrite a cancelled / fully_paid / disputed booking.
      expect(prisma.bookingGroup.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'bg-4',
          status: { in: ['deposit_paid', 'accepted', 'request'] },
        },
        data: { status: 'payment_failed' },
      })
      expect(notifications.notifyPaymentFailedFinal).toHaveBeenCalledWith('pay-4')
      expect(notifications.notifyOffSessionRequiresAction).not.toHaveBeenCalled()
    })

    it('continues processing later rows after one chargeOffSession throws', async () => {
      prisma.payment.findMany.mockResolvedValueOnce([{ id: 'pay-a' }, { id: 'pay-b' }])
      paymentIntents.chargeOffSession
        .mockRejectedValueOnce(new Error('Stripe down'))
        .mockResolvedValueOnce(undefined)
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-b',
        status: PaymentStatus.succeeded,
        attemptCount: 1,
        bookingGroupId: 'bg-b',
      })

      const result = await cron.runBatch()

      expect(paymentIntents.chargeOffSession).toHaveBeenCalledTimes(2)
      // One row threw → we skipped the post-state read for it (no findUnique
      // for pay-a). The second row succeeded normally.
      expect(prisma.payment.findUnique).toHaveBeenCalledTimes(1)
      expect(result).toMatchObject({ succeeded: 1, failed: 0 })
    })
  })

  describe('runBatch — query shape', () => {
    it('combines initial-due, retry-due, and stuck-step-up clauses', async () => {
      prisma.payment.findMany.mockResolvedValueOnce([])

      await cron.runBatch()

      const where = prisma.payment.findMany.mock.calls[0][0].where
      expect(where.kind).toEqual({ in: ['balance', 'full'] })
      expect(where.OR).toHaveLength(3)
      const [initial, retry, stuck] = where.OR
      // Initial — placeholder rows + edge-case non-final statuses.
      expect(initial.status.in).toEqual([
        'processing',
        'requires_payment_method',
        'requires_confirmation',
      ])
      expect(initial.dueAt).toMatchObject({ lte: expect.any(Date) })
      // Retry — failed rows still inside the 48h / 2-attempt window.
      expect(retry.status).toBe('failed')
      expect(retry.attemptCount).toEqual({ lt: 2 })
      expect(retry.nextRetryAt).toMatchObject({ lte: expect.any(Date) })
      // Stuck step-up — requires_action older than 48h. Phase 3 fix Q3.
      expect(stuck.status).toBe('requires_action')
      expect(stuck.updatedAt).toMatchObject({ lte: expect.any(Date) })
    })

    it('selects status alongside id so the loop can branch between chargeOffSession and markStepUpAbandoned', async () => {
      prisma.payment.findMany.mockResolvedValueOnce([])
      await cron.runBatch()
      expect(prisma.payment.findMany.mock.calls[0][0].select).toEqual({
        id: true,
        status: true,
      })
    })
  })

  describe('runBatch — stuck step-up branch (Q3)', () => {
    beforeEach(() => {
      paymentIntents.markStepUpAbandoned = jest.fn().mockResolvedValue(undefined)
    })

    it('routes a requires_action row through markStepUpAbandoned (not chargeOffSession), then runs the exhausted path', async () => {
      prisma.payment.findMany.mockResolvedValueOnce([
        { id: 'pay-stuck', status: PaymentStatus.requires_action },
      ])
      // markStepUpAbandoned has set the row to failed/MAX_ATTEMPTS — that's
      // what the post-state findUnique sees.
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-stuck',
        status: PaymentStatus.failed,
        attemptCount: 2,
        bookingGroupId: 'bg-stuck',
      })

      const result = await cron.runBatch()

      expect(paymentIntents.markStepUpAbandoned).toHaveBeenCalledWith('pay-stuck')
      expect(paymentIntents.chargeOffSession).not.toHaveBeenCalled()
      // Post-state inspection routes the row through the existing
      // exhausted branch (BookingGroup → payment_failed + email).
      expect(result).toMatchObject({ stepUpAbandoned: 1, failed: 1, exhausted: 1 })
      expect(prisma.bookingGroup.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'bg-stuck',
          status: { in: ['deposit_paid', 'accepted', 'request'] },
        },
        data: { status: 'payment_failed' },
      })
      expect(notifications.notifyPaymentFailedFinal).toHaveBeenCalledWith('pay-stuck')
    })

    it('continues the batch when markStepUpAbandoned throws for one row', async () => {
      prisma.payment.findMany.mockResolvedValueOnce([
        { id: 'pay-stuck-a', status: PaymentStatus.requires_action },
        { id: 'pay-due-b', status: PaymentStatus.processing },
      ])
      paymentIntents.markStepUpAbandoned = jest.fn().mockRejectedValueOnce(new Error('Stripe down'))
      prisma.payment.findUnique.mockResolvedValueOnce({
        id: 'pay-due-b',
        status: PaymentStatus.succeeded,
        attemptCount: 1,
        bookingGroupId: 'bg-b',
      })

      const result = await cron.runBatch()

      expect(paymentIntents.markStepUpAbandoned).toHaveBeenCalledTimes(1)
      expect(paymentIntents.chargeOffSession).toHaveBeenCalledWith('pay-due-b')
      expect(result).toMatchObject({ stepUpAbandoned: 0, succeeded: 1 })
    })
  })
})
