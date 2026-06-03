import { NotificationsMetricsService } from '../observability/notifications-metrics.service'

describe('NotificationsMetricsService', () => {
  let metrics: NotificationsMetricsService

  beforeEach(() => {
    metrics = new NotificationsMetricsService()
  })

  it('starts with all counters at zero', () => {
    const s = metrics.snapshot()
    expect(s.enqueuedTotal).toBe(0)
    expect(s.sent.in_app).toBe(0)
    expect(s.sent.email).toBe(0)
    expect(s.failed.in_app).toBe(0)
    expect(s.failed.email).toBe(0)
    expect(s.terminalFailed.in_app).toBe(0)
    expect(s.terminalFailed.email).toBe(0)
    expect(s.skipped.in_app).toBe(0)
    expect(s.skipped.email).toBe(0)
    expect(s.zeroRecipientTransactional).toBe(0)
    expect(s.lastEnqueuedAt).toBeNull()
    expect(s.lastSentAt).toBeNull()
    expect(s.lastFailedAt).toBeNull()
    expect(s.lastCronRunAt).toEqual({})
  })

  it('recordEnqueued adds channel count and stamps lastEnqueuedAt', () => {
    metrics.recordEnqueued(2)
    metrics.recordEnqueued(1)

    const s = metrics.snapshot()
    expect(s.enqueuedTotal).toBe(3)
    expect(s.lastEnqueuedAt).not.toBeNull()
  })

  it('recordSent increments per-channel and stamps lastSentAt', () => {
    metrics.recordSent('in_app')
    metrics.recordSent('email')
    metrics.recordSent('email')

    const s = metrics.snapshot()
    expect(s.sent).toEqual({ in_app: 1, email: 2 })
    expect(s.lastSentAt).not.toBeNull()
  })

  it('recordFailed increments per-channel; terminal flag bumps terminalFailed too', () => {
    metrics.recordFailed('email')
    metrics.recordFailed('email', true)
    metrics.recordFailed('in_app', true)

    const s = metrics.snapshot()
    expect(s.failed).toEqual({ in_app: 1, email: 2 })
    expect(s.terminalFailed).toEqual({ in_app: 1, email: 1 })
    expect(s.lastFailedAt).not.toBeNull()
  })

  it('recordSkipped increments per-channel without touching failed/sent counters', () => {
    metrics.recordSkipped('email')
    metrics.recordSkipped('in_app')

    const s = metrics.snapshot()
    expect(s.skipped).toEqual({ in_app: 1, email: 1 })
    expect(s.failed.email).toBe(0)
    expect(s.sent.email).toBe(0)
  })

  it('recordZeroRecipientTransactional increments the dedicated counter', () => {
    metrics.recordZeroRecipientTransactional()
    metrics.recordZeroRecipientTransactional()

    expect(metrics.snapshot().zeroRecipientTransactional).toBe(2)
  })

  it('recordCronRun stamps lastCronRunAt per cron name', () => {
    metrics.recordCronRun('reconciliation')
    metrics.recordCronRun('provider-engagement')

    const s = metrics.snapshot()
    expect(s.lastCronRunAt['reconciliation']).toBeTruthy()
    expect(s.lastCronRunAt['provider-engagement']).toBeTruthy()
  })

  it('snapshot returns a defensive copy (mutation does not leak back into state)', () => {
    metrics.recordSent('email')
    const s = metrics.snapshot()
    s.sent.email = 999
    expect(metrics.snapshot().sent.email).toBe(1)
  })
})
