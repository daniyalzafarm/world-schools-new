import { NotificationsHealthController } from '../observability/notifications-health.controller'
import { NotificationsMetricsService } from '../observability/notifications-metrics.service'

describe('NotificationsHealthController', () => {
  let metrics: NotificationsMetricsService
  let liveQueue: { getJobCounts: jest.Mock }
  let scheduledQueue: { getJobCounts: jest.Mock }
  let controller: NotificationsHealthController

  beforeEach(() => {
    metrics = new NotificationsMetricsService()
    liveQueue = {
      getJobCounts: jest
        .fn()
        .mockResolvedValue({ waiting: 1, active: 2, delayed: 0, failed: 0, completed: 100 }),
    }
    scheduledQueue = {
      getJobCounts: jest
        .fn()
        .mockResolvedValue({ waiting: 0, active: 0, delayed: 25, failed: 1, completed: 5 }),
    }
    controller = new NotificationsHealthController(
      liveQueue as never,
      scheduledQueue as never,
      metrics
    )
  })

  it('returns ok status + merged queue depths + metrics snapshot on the happy path', async () => {
    metrics.recordSent('email')
    metrics.recordEnqueued(2)

    const result = await controller.check()

    expect(result.status).toBe('ok')
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(result.queues).toEqual({
      live: { waiting: 1, active: 2, delayed: 0, failed: 0, completed: 100 },
      scheduled: { waiting: 0, active: 0, delayed: 25, failed: 1, completed: 5 },
    })
    expect(result.metrics.sent.email).toBe(1)
    expect(result.metrics.enqueuedTotal).toBe(2)
  })

  it('marks status as "degraded" when a queue depth lookup fails', async () => {
    scheduledQueue.getJobCounts.mockRejectedValueOnce(new Error('Redis unreachable'))

    const result = await controller.check()

    expect(result.status).toBe('degraded')
    expect(result.queues.live).toEqual(expect.objectContaining({ waiting: 1, active: 2 }))
    expect(result.queues.scheduled).toEqual({ error: 'Redis unreachable' })
  })

  it('queries both queues in parallel (Promise.all) — not sequential', async () => {
    // Stagger response times to verify both started before either resolved.
    // eslint-disable-next-line no-unused-vars
    let liveResolve: (v: unknown) => void = () => undefined
    // eslint-disable-next-line no-unused-vars
    let scheduledResolve: (v: unknown) => void = () => undefined
    liveQueue.getJobCounts.mockReturnValueOnce(
      new Promise(r => {
        liveResolve = r
      })
    )
    scheduledQueue.getJobCounts.mockReturnValueOnce(
      new Promise(r => {
        scheduledResolve = r
      })
    )

    const checkPromise = controller.check()
    expect(liveQueue.getJobCounts).toHaveBeenCalledTimes(1)
    expect(scheduledQueue.getJobCounts).toHaveBeenCalledTimes(1)

    liveResolve({ waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 })
    scheduledResolve({ waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 })
    await checkPromise
  })
})
