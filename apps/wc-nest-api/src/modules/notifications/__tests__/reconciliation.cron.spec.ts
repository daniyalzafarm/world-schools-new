import { Test, type TestingModule } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { NotificationType } from '@world-schools/wc-types'
import { PrismaService } from '../../../prisma/prisma.service'
import { RedisService } from '../../redis/redis.service'
import { NotificationReconciliationCron } from '../crons/reconciliation.cron'
import { NOTIFICATION_DISPATCH_EVENT } from '../dispatcher/notify'
import { NotificationsMetricsService } from '../observability/notifications-metrics.service'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

interface MockPrisma {
  bookingGroup: { findMany: jest.Mock }
}

describe('NotificationReconciliationCron', () => {
  let cron: NotificationReconciliationCron
  let prisma: MockPrisma
  let redis: {
    isReady: jest.Mock
    getClient: jest.Mock
    del: jest.Mock
  }
  let redisClient: { set: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let metrics: NotificationsMetricsService

  beforeEach(async () => {
    prisma = {
      bookingGroup: { findMany: jest.fn().mockResolvedValue([]) },
    }
    redisClient = { set: jest.fn().mockResolvedValue('OK') }
    redis = {
      isReady: jest.fn().mockReturnValue(true),
      getClient: jest.fn().mockReturnValue(redisClient),
      del: jest.fn().mockResolvedValue(undefined),
    }
    eventEmitter = { emit: jest.fn().mockReturnValue(true) }
    metrics = new NotificationsMetricsService()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationReconciliationCron,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: NotificationsMetricsService, useValue: metrics },
      ],
    }).compile()

    cron = module.get(NotificationReconciliationCron)
  })

  describe('run() — lock + lifecycle', () => {
    it('returns early without running helpers if the Redis lock is not acquired', async () => {
      redisClient.set.mockResolvedValueOnce(null) // lock already held by another instance

      await cron.run()

      expect(prisma.bookingGroup.findMany).not.toHaveBeenCalled()
      expect(redis.del).not.toHaveBeenCalled()
    })

    it('releases the lock even when a reconcile helper throws', async () => {
      prisma.bookingGroup.findMany.mockRejectedValueOnce(new Error('db down'))

      await cron.run() // should not throw — error is caught

      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining('cron:lock:notification-reconciliation:daily')
      )
    })

    it('does nothing when Redis is not ready (skipping the lock acquire)', async () => {
      redis.isReady.mockReturnValue(false)

      await cron.run()

      expect(redisClient.set).not.toHaveBeenCalled()
      expect(prisma.bookingGroup.findMany).not.toHaveBeenCalled()
    })

    it('records a cron-run heartbeat on successful completion', async () => {
      await cron.run()

      expect(metrics.snapshot().lastCronRunAt['reconciliation']).toBeTruthy()
    })
  })

  describe('reconcileBookingRequestTiers', () => {
    it('emits a notify per group per tier within the firing window', async () => {
      // Plant a BookingGroup whose createdAt is exactly 48h before now.
      // The 48h tier's runAt = createdAt + 48h = now → too close (<= now),
      // so push 1h further to land it in the firing window.
      const createdAt = new Date(Date.now() - 47 * HOUR_MS)
      prisma.bookingGroup.findMany.mockResolvedValue([{ id: 'BG-1', createdAt }])

      await (
        cron as never as { reconcileBookingRequestTiers: () => Promise<number> }
      ).reconcileBookingRequestTiers()

      // 5 tiers iterated: ParentBookingRequestStillPending, ParentBookingExpired,
      // ProviderBookingRequest48hReminder, ProviderBookingRequestFinalReminder,
      // ProviderBookingRequestExpired. Each tier queries findMany once.
      expect(prisma.bookingGroup.findMany).toHaveBeenCalledTimes(5)

      // The BG-1 createdAt only sits in the 48h window for the 48h tier.
      // For 60h / 72h tiers it falls outside, so findMany would still
      // return [BG-1] in our mock but only the 48h tier's runAt is > now.
      // Actual emit count is therefore 2 (the two 48h tiers).
      const emitCalls = eventEmitter.emit.mock.calls.filter(
        c => c[0] === NOTIFICATION_DISPATCH_EVENT
      )
      const types = emitCalls.map(c => c[1].type)
      expect(types).toContain(NotificationType.ParentBookingRequestStillPending)
      expect(types).toContain(NotificationType.ProviderBookingRequest48hReminder)
    })

    it('skips emitting when runAt has already passed (createdAt + offset < now)', async () => {
      // Plant a group submitted 100h ago — every tier's runAt is in the past.
      const createdAt = new Date(Date.now() - 100 * HOUR_MS)
      prisma.bookingGroup.findMany.mockResolvedValue([{ id: 'BG-old', createdAt }])

      await (
        cron as never as { reconcileBookingRequestTiers: () => Promise<number> }
      ).reconcileBookingRequestTiers()

      const dispatchEmits = eventEmitter.emit.mock.calls.filter(
        c => c[0] === NOTIFICATION_DISPATCH_EVENT
      )
      expect(dispatchEmits).toHaveLength(0)
    })
  })

  describe('reconcilePreCampTiers', () => {
    it('emits parent + provider pre-camp notifications for upcoming sessions', async () => {
      // session.startDate = now + 14d (matches the 14d tier exactly)
      // Push 1h into the future so runAt > now.
      const startDate = new Date(Date.now() + 14 * DAY_MS + HOUR_MS)
      prisma.bookingGroup.findMany.mockResolvedValue([{ id: 'BG-2', session: { startDate } }])

      await (
        cron as never as { reconcilePreCampTiers: () => Promise<number> }
      ).reconcilePreCampTiers()

      expect(prisma.bookingGroup.findMany).toHaveBeenCalledTimes(6) // 6 tiers
      const types = eventEmitter.emit.mock.calls
        .filter(c => c[0] === NOTIFICATION_DISPATCH_EVENT)
        .map(c => c[1].type)
      expect(types).toContain(NotificationType.ParentPreCampChecklist14d)
      expect(types).toContain(NotificationType.ProviderPreCampRosterReady)
    })
  })

  describe('reconcileProviderPostCamp', () => {
    it('emits ProviderPostCampWrap for sessions ending in the last 25h', async () => {
      // endDate = now - 23h → runAt = endDate + 24h = now + 1h (future, valid)
      const endDate = new Date(Date.now() - 23 * HOUR_MS)
      prisma.bookingGroup.findMany.mockResolvedValue([{ id: 'BG-3', session: { endDate } }])

      const count = await (
        cron as never as { reconcileProviderPostCamp: () => Promise<number> }
      ).reconcileProviderPostCamp()

      expect(count).toBe(1)
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        NOTIFICATION_DISPATCH_EVENT,
        expect.objectContaining({
          type: NotificationType.ProviderPostCampWrap,
          context: { bookingGroupId: 'BG-3' },
        })
      )
    })
  })

  describe('reconcilePostDeclineAlternatives', () => {
    it('emits ParentConversionPostDeclineAlternatives at +24h after decline', async () => {
      // updatedAt = now - 23h → runAt = updatedAt + 24h = now + 1h
      const updatedAt = new Date(Date.now() - 23 * HOUR_MS)
      prisma.bookingGroup.findMany.mockResolvedValue([{ id: 'BG-4', updatedAt }])

      await (
        cron as never as { reconcilePostDeclineAlternatives: () => Promise<number> }
      ).reconcilePostDeclineAlternatives()

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        NOTIFICATION_DISPATCH_EVENT,
        expect.objectContaining({
          type: NotificationType.ParentConversionPostDeclineAlternatives,
          context: { bookingGroupId: 'BG-4' },
        })
      )
    })
  })
})
