import { ScheduledCaptureStatus } from '../../../../generated/client/enums'
import { ScheduledCaptureReconciliationCron } from './scheduled-capture-reconciliation.cron'

const NOW = new Date('2026-08-10T00:00:00.000Z')

function buildHarness(
  dueRows: Array<{ bookingGroupId: string; sequence: number }>,
  stuckRows: Array<{ bookingGroupId: string }> = [],
  processingRows: Array<{ id: string; bookingGroupId: string; sequence: number }> = []
) {
  const prisma: any = {
    bookingScheduledCapture: {
      // The cron runs three queries against this table: stuck `processing` rows
      // (reaper), due `scheduled` rows, then `failed` rows past retry.
      // Differentiate by `where.status`.
      findMany: jest.fn().mockImplementation((args: any) => {
        switch (args.where.status) {
          case ScheduledCaptureStatus.processing:
            return Promise.resolve(processingRows)
          case ScheduledCaptureStatus.failed:
            return Promise.resolve(stuckRows)
          default:
            return Promise.resolve(dueRows)
        }
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    bookingGroup: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  }
  const redis = { getClient: jest.fn() }
  const engine = { executeCapture: jest.fn() }
  const eventEmitter = { emit: jest.fn() }
  const paymentAuditLog = { append: jest.fn(), appendSafe: jest.fn().mockResolvedValue(undefined) }
  const cron = new ScheduledCaptureReconciliationCron(
    prisma as any,
    redis as any,
    engine as any,
    eventEmitter as any,
    paymentAuditLog as any
  )
  return { cron, prisma, engine, eventEmitter, paymentAuditLog }
}

/** Find the findMany call whose `where.status` matches the given status. */
function whereForStatus(findMany: jest.Mock, status: ScheduledCaptureStatus) {
  const call = findMany.mock.calls.find((c: any[]) => c[0].where.status === status)
  return call?.[0].where
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

    expect(result).toEqual({
      processed: 3,
      completed: 1,
      failed: 1,
      escalated: 0,
      reapedDeposits: 0,
    })
    expect(engine.executeCapture).toHaveBeenCalledTimes(3)
    expect(engine.executeCapture).toHaveBeenCalledWith('bg-1', 0, NOW)

    // The eligibility query encodes the acceptance guard: scheduled + due +
    // booking in a capture-eligible status + respondedAt present.
    const dueWhere = whereForStatus(
      prisma.bookingScheduledCapture.findMany,
      ScheduledCaptureStatus.scheduled
    )
    expect(dueWhere.effectiveCaptureDate).toEqual({ lte: NOW })
    expect(dueWhere.bookingGroup.respondedAt).toEqual({ not: null })
    expect(Array.isArray(dueWhere.bookingGroup.status.in)).toBe(true)
  })

  it('escalates bookings whose capture stayed failed past the retry window to payment_review', async () => {
    const { cron, prisma, eventEmitter, paymentAuditLog } = buildHarness(
      [],
      [{ bookingGroupId: 'bg-9' }]
    )
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
    const stuckWhere = whereForStatus(
      prisma.bookingScheduledCapture.findMany,
      ScheduledCaptureStatus.failed
    )
    expect(stuckWhere.retryDeadline).toEqual({ lte: NOW })
    expect(stuckWhere.bookingGroup.paymentReviewStatus).toBeNull()
    // Spec v2.3: the escalation writes a 10-yr-retention audit row and alerts
    // superadmins to triage (never auto-cancel).
    expect(paymentAuditLog.appendSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingGroupId: 'bg-9',
        eventType: 'payment_review_flagged',
        newStatus: 'payment_review',
      })
    )
    expect(eventEmitter.emit).toHaveBeenCalled()
  })

  it('no-ops cleanly when nothing is due, stuck, or processing', async () => {
    const { cron, engine, prisma } = buildHarness([], [], [])
    expect(await cron.runBatch(NOW)).toEqual({
      processed: 0,
      completed: 0,
      failed: 0,
      escalated: 0,
      reapedDeposits: 0,
    })
    expect(engine.executeCapture).not.toHaveBeenCalled()
    expect(prisma.bookingGroup.updateMany).not.toHaveBeenCalled()
  })

  describe('stuck-processing reaper', () => {
    it('resets a stuck DEPOSIT capture (seq 0) back to scheduled — idempotent re-capture is safe', async () => {
      const { cron, prisma } = buildHarness(
        [],
        [],
        [{ id: 'cap-d', bookingGroupId: 'bg-1', sequence: 0 }]
      )

      const result = await cron.runBatch(NOW)

      expect(result.reapedDeposits).toBe(1)
      // Status-guarded reset processing → scheduled (no booking flip).
      expect(prisma.bookingScheduledCapture.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cap-d', status: ScheduledCaptureStatus.processing },
          data: { status: ScheduledCaptureStatus.scheduled },
        })
      )
      expect(prisma.bookingGroup.updateMany).not.toHaveBeenCalled()
      // The reaper query targets stale processing rows.
      const procWhere = whereForStatus(
        prisma.bookingScheduledCapture.findMany,
        ScheduledCaptureStatus.processing
      )
      expect(procWhere.updatedAt.lte).toBeInstanceOf(Date)
      expect(procWhere.updatedAt.lte.getTime()).toBeLessThan(NOW.getTime())
    })

    it('escalates a stuck BALANCE capture (seq > 0) to payment_review — never auto-re-charges', async () => {
      const { cron, prisma, eventEmitter } = buildHarness(
        [],
        [],
        [{ id: 'cap-b', bookingGroupId: 'bg-2', sequence: 1 }]
      )

      const result = await cron.runBatch(NOW)

      expect(result.escalated).toBe(1)
      expect(result.reapedDeposits).toBe(0)
      // No scheduled-capture status reset for a balance row — only a booking flip.
      expect(prisma.bookingScheduledCapture.updateMany).not.toHaveBeenCalled()
      expect(prisma.bookingGroup.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'bg-2', paymentReviewStatus: null }),
          data: expect.objectContaining({
            status: 'payment_review',
            paymentReviewStatus: 'stuck_processing',
          }),
        })
      )
      expect(eventEmitter.emit).toHaveBeenCalled()
    })
  })
})
