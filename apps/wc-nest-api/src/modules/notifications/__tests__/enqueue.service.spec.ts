import { NotificationsEnqueueService } from '../queue/enqueue.service'
import { NotificationsMetricsService } from '../observability/notifications-metrics.service'

interface MockQueue {
  add: jest.Mock
}

describe('NotificationsEnqueueService', () => {
  let liveQueue: MockQueue
  let scheduledQueue: MockQueue
  let metrics: NotificationsMetricsService
  let service: NotificationsEnqueueService

  beforeEach(() => {
    liveQueue = { add: jest.fn().mockResolvedValue(undefined) }
    scheduledQueue = { add: jest.fn().mockResolvedValue(undefined) }
    metrics = new NotificationsMetricsService()
    service = new NotificationsEnqueueService(liveQueue as never, scheduledQueue as never, metrics)
  })

  const baseOpts = {
    type: 'parent.booking.accepted',
    recipientUserId: 'u-1',
    context: { bookingGroupId: 'BG-1' },
    dedupeKey: 'u-1:BG-1',
  }

  describe('queue routing', () => {
    it('routes to the live queue when delay is 0 (or absent)', async () => {
      await service.enqueue({ ...baseOpts, channels: ['email'] })

      expect(liveQueue.add).toHaveBeenCalledTimes(1)
      expect(scheduledQueue.add).not.toHaveBeenCalled()
    })

    it('routes to the scheduled queue when delay > 0', async () => {
      await service.enqueue({ ...baseOpts, channels: ['email'], delay: 60_000 })

      expect(scheduledQueue.add).toHaveBeenCalledTimes(1)
      expect(liveQueue.add).not.toHaveBeenCalled()
    })

    it('uses a deterministic, colon-free jobId for BullMQ dedup', async () => {
      await service.enqueue({ ...baseOpts, channels: ['email'] })

      const [, , opts] = liveQueue.add.mock.calls[0]
      // BullMQ rejects custom ids containing ':' ("Custom Id cannot contain :"),
      // so the enqueue service swaps every ':' for '_'.
      expect(opts.jobId).toBe('parent.booking.accepted_u-1_u-1_BG-1')
      expect(opts.jobId).not.toContain(':')
    })
  })

  describe('per-channel retry override (Phase 14d)', () => {
    it('uses tighter retry (3 attempts, 5s fixed) for in-app-only jobs', async () => {
      await service.enqueue({ ...baseOpts, channels: ['in_app'] })

      const [, , opts] = liveQueue.add.mock.calls[0]
      expect(opts.attempts).toBe(3)
      expect(opts.backoff).toEqual({ type: 'fixed', delay: 5_000 })
    })

    it('inherits the queue default retry for email-only jobs (no per-job override)', async () => {
      await service.enqueue({ ...baseOpts, channels: ['email'] })

      const [, , opts] = liveQueue.add.mock.calls[0]
      expect(opts.attempts).toBeUndefined()
      expect(opts.backoff).toBeUndefined()
    })

    it('inherits the queue default retry for mixed in-app + email jobs', async () => {
      await service.enqueue({ ...baseOpts, channels: ['in_app', 'email'] })

      const [, , opts] = liveQueue.add.mock.calls[0]
      // Mixed: email leg dominates failure modes, so we keep the
      // 5×exp-30s default; no per-job override.
      expect(opts.attempts).toBeUndefined()
    })
  })

  describe('metrics + error handling', () => {
    it('bumps the enqueued counter by the number of channels', async () => {
      await service.enqueue({ ...baseOpts, channels: ['in_app', 'email'] })

      expect(metrics.snapshot().enqueuedTotal).toBe(2)
    })

    it('never throws when queue.add rejects (domain caller is still mid-commit)', async () => {
      liveQueue.add.mockRejectedValueOnce(new Error('Redis exploded'))

      await expect(service.enqueue({ ...baseOpts, channels: ['email'] })).resolves.toBeUndefined()
      // Failed enqueues should NOT bump the counter.
      expect(metrics.snapshot().enqueuedTotal).toBe(0)
    })
  })
})
