import { NotificationsFailureListener } from '../observability/notifications-failure.listener'
import { NotificationsMetricsService } from '../observability/notifications-metrics.service'

interface MockQueue {
  opts: { connection: unknown }
  getJob: jest.Mock
}

interface MockPrisma {
  notificationDelivery: { upsert: jest.Mock }
}

describe('NotificationsFailureListener', () => {
  let liveQueue: MockQueue
  let scheduledQueue: MockQueue
  let prisma: MockPrisma
  let metrics: NotificationsMetricsService
  let listener: NotificationsFailureListener

  beforeEach(() => {
    liveQueue = { opts: { connection: {} }, getJob: jest.fn() }
    scheduledQueue = { opts: { connection: {} }, getJob: jest.fn() }
    prisma = {
      notificationDelivery: { upsert: jest.fn().mockResolvedValue(undefined) },
    }
    metrics = new NotificationsMetricsService()
    listener = new NotificationsFailureListener(
      liveQueue as never,
      scheduledQueue as never,
      prisma as never,
      metrics
    )
  })

  /**
   * The handleFailed method is private; we exercise it directly via type
   * assertion so we can assert on the metric + audit-row side effects
   * without spinning up a real BullMQ QueueEvents subscriber.
   */
  function handle(jobId: string, failedReason: string): Promise<void> {
    return (
      listener as never as {
        // eslint-disable-next-line no-unused-vars
        handleFailed: (q: string, queue: MockQueue, j: string, r: string) => Promise<void>
      }
    ).handleFailed('notifications', liveQueue, jobId, failedReason)
  }

  it('records a NON-terminal failed metric when attemptsMade < maxAttempts', async () => {
    liveQueue.getJob.mockResolvedValueOnce({
      attemptsMade: 2,
      opts: { attempts: 5 },
      data: {
        type: 'parent.booking.accepted',
        recipientUserId: 'u-1',
        channels: ['email'],
        dedupeKey: 'u-1:BG-1',
      },
    })

    await handle('job-1', 'SMTP timeout')

    const snap = metrics.snapshot()
    expect(snap.failed.email).toBe(1)
    expect(snap.terminalFailed.email).toBe(0) // not terminal yet
    expect(prisma.notificationDelivery.upsert).not.toHaveBeenCalled() // worker writes the row
  })

  it('records a TERMINAL failed metric AND writes a defensive delivery row when retries are exhausted', async () => {
    liveQueue.getJob.mockResolvedValueOnce({
      attemptsMade: 5,
      opts: { attempts: 5 },
      data: {
        type: 'parent.booking.accepted',
        recipientUserId: 'u-1',
        channels: ['email', 'in_app'],
        dedupeKey: 'u-1:BG-1',
      },
    })

    await handle('job-1', 'final failure\n  at stack:1\n  at stack:2')

    const snap = metrics.snapshot()
    expect(snap.failed.email).toBe(1)
    expect(snap.failed.in_app).toBe(1)
    expect(snap.terminalFailed.email).toBe(1)
    expect(snap.terminalFailed.in_app).toBe(1)

    // One upsert per channel; errorMessage sanitised to first line only.
    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledTimes(2)
    for (const call of prisma.notificationDelivery.upsert.mock.calls) {
      expect(call[0].create.errorMessage).toBe('final failure')
      expect(call[0].create.status).toBe('failed')
    }
  })

  it('does nothing when the job has been removed from the queue (getJob returns null)', async () => {
    liveQueue.getJob.mockResolvedValueOnce(null)

    await handle('job-gone', 'whatever')

    expect(prisma.notificationDelivery.upsert).not.toHaveBeenCalled()
    expect(metrics.snapshot().failed.email).toBe(0)
  })

  it('swallows internal errors so the listener never crashes the worker', async () => {
    liveQueue.getJob.mockRejectedValueOnce(new Error('Redis down'))

    await expect(handle('job-x', 'reason')).resolves.toBeUndefined()
  })

  it('skips the defensive write when the payload is missing dedupeKey or channels', async () => {
    liveQueue.getJob.mockResolvedValueOnce({
      attemptsMade: 5,
      opts: { attempts: 5 },
      data: {
        type: 'parent.booking.accepted',
        recipientUserId: 'u-1',
        channels: [],
        dedupeKey: '',
      },
    })

    await handle('job-empty', 'fail')

    expect(prisma.notificationDelivery.upsert).not.toHaveBeenCalled()
  })
})
