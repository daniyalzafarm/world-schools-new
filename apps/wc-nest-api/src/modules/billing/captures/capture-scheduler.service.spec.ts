import { Prisma } from '../../../generated/client/client'
import { CaptureSchedulerService } from './capture-scheduler.service'

const NOW = new Date('2026-06-01T00:00:00.000Z')

const POLICY_SNAPSHOT = {
  policyName: 'moderate',
  tiers: [
    { daysBeforeStart: 60, refundPercentage: 100 },
    { daysBeforeStart: 30, refundPercentage: 50 },
    { daysBeforeStart: 0, refundPercentage: 0 },
  ],
  specialCircumstances: [],
  capturedAt: '2026-05-01T00:00:00.000Z',
  schemaVersion: 1,
}

function buildBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bg-1',
    totalAmount: new Prisma.Decimal('2000.00'),
    depositAmount: new Prisma.Decimal('600.00'),
    graceDeadline: new Date('2026-05-20T00:00:00.000Z'), // past → grace expired
    respondedAt: NOW,
    appFeePercentageSnapshot: new Prisma.Decimal('15'),
    cancellationPolicySnapshot: POLICY_SNAPSHOT,
    session: { startDate: new Date('2026-12-01T00:00:00.000Z') }, // far out
    provider: { settings: { timezone: 'UTC', currency: 'GBP' } },
    ...overrides,
  }
}

function buildHarness(booking: ReturnType<typeof buildBooking> | null, existingCount = 0) {
  const prisma: any = {
    bookingGroup: { findUnique: jest.fn().mockResolvedValue(booking), update: jest.fn() },
    bookingScheduledCapture: {
      count: jest.fn().mockResolvedValue(existingCount),
      createMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
  }
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma))
  const engine = { executeCapture: jest.fn().mockResolvedValue({ status: 'completed' }) }
  const enqueue = { enqueue: jest.fn().mockResolvedValue(undefined) }

  const service = new CaptureSchedulerService(prisma as any, engine as any, enqueue as any)
  return { service, prisma, engine, enqueue }
}

describe('CaptureSchedulerService.materializeForBooking', () => {
  it('is idempotent — no-op when rows already exist', async () => {
    const { service, prisma, engine, enqueue } = buildHarness(buildBooking(), 3)
    await service.materializeForBooking('bg-1', NOW)
    expect(prisma.bookingScheduledCapture.createMany).not.toHaveBeenCalled()
    expect(engine.executeCapture).not.toHaveBeenCalled()
    expect(enqueue.enqueue).not.toHaveBeenCalled()
  })

  it('grace already expired → inserts rows, fires the deposit now, enqueues future balance captures', async () => {
    const { service, prisma, engine, enqueue } = buildHarness(buildBooking())
    await service.materializeForBooking('bg-1', NOW)

    // Deposit (seq 0) + two balance increments (Moderate 50/50) = 3 rows.
    const rows = prisma.bookingScheduledCapture.createMany.mock.calls[0][0].data
    expect(rows).toHaveLength(3)
    expect(rows[0].sequence).toBe(0)
    // Application fee snapshotted proportionally (deposit 600 * 15% = 90.00).
    expect(rows[0].applicationFeeAmount.toFixed(2)).toBe('90.00')

    // Deposit effectiveCaptureDate = max(graceDeadline past, acceptance=NOW) = NOW → due now.
    expect(engine.executeCapture).toHaveBeenCalledWith('bg-1', 0, NOW)
    // Balance boundaries (Oct/Nov 2026) are in the future → enqueued, not fired.
    expect(enqueue.enqueue).toHaveBeenCalledTimes(2)
    expect(engine.executeCapture).toHaveBeenCalledTimes(1)
  })

  it('within grace → defers the deposit capture to a delayed job (does not fire it now)', async () => {
    const { service, engine, enqueue } = buildHarness(
      buildBooking({ graceDeadline: new Date('2026-06-10T00:00:00.000Z') }) // future
    )
    await service.materializeForBooking('bg-1', NOW)

    // Nothing is due now — deposit defers to graceDeadline, balances to boundaries.
    expect(engine.executeCapture).not.toHaveBeenCalled()
    expect(enqueue.enqueue).toHaveBeenCalledTimes(3)
    // Deposit (seq 0) enqueued at the grace deadline.
    expect(enqueue.enqueue).toHaveBeenCalledWith(
      'bg-1',
      0,
      new Date('2026-06-10T00:00:00.000Z'),
      NOW
    )
  })

  it('no-ops when the booking is missing', async () => {
    const { service, prisma } = buildHarness(null)
    await service.materializeForBooking('bg-1', NOW)
    expect(prisma.bookingScheduledCapture.count).not.toHaveBeenCalled()
  })
})
