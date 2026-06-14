import { ScheduledCaptureStatus } from '../../../../generated/client/enums'
import { ScheduledCaptureReconciliationCron } from './scheduled-capture-reconciliation.cron'

const NOW = new Date('2026-08-10T00:00:00.000Z')

function buildHarness(
  dueRows: Array<{ bookingGroupId: string; sequence: number }>,
  stuckRows: Array<{ bookingGroupId: string }> = []
) {
  const prisma: any = {
    bookingScheduledCapture: {
      // The cron runs two queries against this table: due `scheduled` rows, then
      // `failed` rows past their retry window. Differentiate by `where.status`.
      findMany: jest
        .fn()
        .mockImplementation((args: any) =>
          Promise.resolve(args.where.status === ScheduledCaptureStatus.failed ? stuckRows : dueRows)
        ),
    },
    bookingGroup: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  }
  const redis = { getClient: jest.fn() }
  const engine = { executeCapture: jest.fn() }
  const cron = new ScheduledCaptureReconciliationCron(prisma as any, redis as any, engine as any)
  return { cron, prisma, engine }
}

describe('ScheduledCaptureReconciliationCron.runBatch', () => {
  it('queries only due, capture-eligible rows and tallies engine outcomes', async () => {
    const { cron, prisma, engine } = buildHarness([
      { bookingGroupId: 'bg-1', sequence: 0 },
      { bookingGroupId: 'bg-1', sequence: 1 },
      { bookingGroupId: 'bg-2', sequence: 1 },
    ])
    engine.executeCapture
      .mockResolvedValueOnce({ status: 'completed' })
      .mockResolvedValueOnce({ status: 'failed', reason: 'declined' })
      .mockResolvedValueOnce({ status: 'skipped', reason: 'claimed by another runner' })

    const result = await cron.runBatch(NOW)

    expect(result).toEqual({ processed: 3, completed: 1, failed: 1, escalated: 0 })
    expect(engine.executeCapture).toHaveBeenCalledTimes(3)
    expect(engine.executeCapture).toHaveBeenCalledWith('bg-1', 0, NOW)

    // The eligibility query encodes the acceptance guard: scheduled + due +
    // booking in a capture-eligible status + respondedAt present.
    const dueWhere = prisma.bookingScheduledCapture.findMany.mock.calls[0][0].where
    expect(dueWhere.status).toBe('scheduled')
    expect(dueWhere.effectiveCaptureDate).toEqual({ lte: NOW })
    expect(dueWhere.bookingGroup.respondedAt).toEqual({ not: null })
    expect(Array.isArray(dueWhere.bookingGroup.status.in)).toBe(true)
  })

  it('escalates bookings whose capture stayed failed past the retry window to payment_review', async () => {
    const { cron, prisma } = buildHarness([], [{ bookingGroupId: 'bg-9' }])
    const result = await cron.runBatch(NOW)

    expect(result.escalated).toBe(1)
    // Flags payment_review with a status guard (never overwrites a terminal
    // status, never re-escalates an already-flagged booking).
    expect(prisma.bookingGroup.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'bg-9', paymentReviewStatus: null }),
        data: expect.objectContaining({
          status: 'payment_review',
          paymentReviewStatus: 'capture_failed',
          paymentReviewFlaggedAt: NOW,
        }),
      })
    )
    // The escalation query targets failed rows past their retry deadline.
    const stuckWhere = prisma.bookingScheduledCapture.findMany.mock.calls[1][0].where
    expect(stuckWhere.status).toBe('failed')
    expect(stuckWhere.retryDeadline).toEqual({ lte: NOW })
    expect(stuckWhere.bookingGroup.paymentReviewStatus).toBeNull()
  })

  it('no-ops cleanly when nothing is due or stuck', async () => {
    const { cron, engine, prisma } = buildHarness([], [])
    expect(await cron.runBatch(NOW)).toEqual({
      processed: 0,
      completed: 0,
      failed: 0,
      escalated: 0,
    })
    expect(engine.executeCapture).not.toHaveBeenCalled()
    expect(prisma.bookingGroup.updateMany).not.toHaveBeenCalled()
  })
})
