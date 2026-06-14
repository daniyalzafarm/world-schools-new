import { ScheduledCaptureReconciliationCron } from './scheduled-capture-reconciliation.cron'

const NOW = new Date('2026-08-10T00:00:00.000Z')

function buildHarness(dueRows: Array<{ bookingGroupId: string; sequence: number }>) {
  const prisma = {
    bookingScheduledCapture: { findMany: jest.fn().mockResolvedValue(dueRows) },
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

    expect(result).toEqual({ processed: 3, completed: 1, failed: 1 })
    expect(engine.executeCapture).toHaveBeenCalledTimes(3)
    expect(engine.executeCapture).toHaveBeenCalledWith('bg-1', 0, NOW)

    // The eligibility query encodes the acceptance guard: scheduled + due +
    // booking in a capture-eligible status + respondedAt present.
    const where = prisma.bookingScheduledCapture.findMany.mock.calls[0][0].where
    expect(where.status).toBe('scheduled')
    expect(where.effectiveCaptureDate).toEqual({ lte: NOW })
    expect(where.bookingGroup.respondedAt).toEqual({ not: null })
    expect(Array.isArray(where.bookingGroup.status.in)).toBe(true)
  })

  it('no-ops cleanly when nothing is due', async () => {
    const { cron, engine } = buildHarness([])
    expect(await cron.runBatch(NOW)).toEqual({ processed: 0, completed: 0, failed: 0 })
    expect(engine.executeCapture).not.toHaveBeenCalled()
  })
})
