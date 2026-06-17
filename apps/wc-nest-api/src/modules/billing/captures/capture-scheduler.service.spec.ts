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
    depositCapturedAt: null as Date | null,
    graceDeadline: new Date('2026-05-20T00:00:00.000Z'), // past → grace expired
    respondedAt: NOW,
    appFeePercentageSnapshot: new Prisma.Decimal('15'),
    cancellationPolicySnapshot: POLICY_SNAPSHOT,
    session: { startDate: new Date('2026-12-01T00:00:00.000Z') }, // far out
    provider: { settings: { timezone: 'UTC', currency: 'GBP' } },
    ...overrides,
  }
}

function buildHarness(
  booking: ReturnType<typeof buildBooking> | null,
  existingCount = 0,
  existingCaptures: Array<{ sequence: number; status: string; amount: Prisma.Decimal }> = []
) {
  const prisma: any = {
    bookingGroup: { findUnique: jest.fn().mockResolvedValue(booking), update: jest.fn() },
    bookingScheduledCapture: {
      count: jest.fn().mockResolvedValue(existingCount),
      findMany: jest.fn().mockResolvedValue(existingCaptures),
      createMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
  }
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma))
  const engine = { executeCapture: jest.fn().mockResolvedValue({ status: 'completed' }) }
  const enqueue = { enqueue: jest.fn().mockResolvedValue(undefined) }
  const cancelCapture = { cancelForBooking: jest.fn().mockResolvedValue(undefined) }

  const service = new CaptureSchedulerService(
    prisma as any,
    engine as any,
    enqueue as any,
    cancelCapture as any
  )
  return { service, prisma, engine, enqueue, cancelCapture }
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

describe('CaptureSchedulerService.rematerializeForBooking (§9.7 reschedule)', () => {
  const NEW_START = new Date('2027-06-01T00:00:00.000Z') // far future → all enqueued

  const dec = (v: string) => new Prisma.Decimal(v)

  it('all-scheduled booking → cancels old rows + regenerates against the new start with fresh sequences', async () => {
    const { service, prisma, cancelCapture, enqueue, engine } = buildHarness(buildBooking(), 3, [
      { sequence: 0, status: 'scheduled', amount: dec('600.00') },
      { sequence: 1, status: 'scheduled', amount: dec('700.00') },
      { sequence: 2, status: 'scheduled', amount: dec('700.00') },
    ])

    await service.rematerializeForBooking('bg-1', NEW_START, NOW)

    // The not-yet-fired rows are cancelled.
    expect(cancelCapture.cancelForBooking).toHaveBeenCalledWith('bg-1', 'rescheduled', prisma)
    // Deposit (600) + two balance (700 each) regenerated, sequences ABOVE the old max (2) → 3,4,5.
    const rows = prisma.bookingScheduledCapture.createMany.mock.calls[0][0].data
    expect(rows.map((r: any) => r.sequence)).toEqual([3, 4, 5])
    expect(rows[0].amount.toFixed(2)).toBe('600.00')
    // Grace already expired (acceptance = now), so the re-scheduled deposit fires
    // immediately; the two future balance boundaries are enqueued.
    expect(engine.executeCapture).toHaveBeenCalledTimes(1)
    expect(engine.executeCapture).toHaveBeenCalledWith('bg-1', 3, NOW)
    expect(enqueue.enqueue).toHaveBeenCalledTimes(2)
  })

  it('deposit + one balance already captured → excludes them, reschedules only the remainder', async () => {
    const { service, prisma } = buildHarness(
      buildBooking({ depositCapturedAt: new Date('2026-05-21T00:00:00.000Z') }),
      2,
      [
        { sequence: 0, status: 'completed', amount: dec('600.00') }, // deposit captured
        { sequence: 1, status: 'completed', amount: dec('700.00') }, // first balance captured
        { sequence: 2, status: 'scheduled', amount: dec('700.00') }, // remaining balance
      ]
    )

    await service.rematerializeForBooking('bg-1', NEW_START, NOW)

    // Remaining balance = 2000 − 600 deposit − 700 captured = 700, on Moderate (50/50) → 350 + 350.
    const rows = prisma.bookingScheduledCapture.createMany.mock.calls[0][0].data
    expect(rows.map((r: any) => r.sequence)).toEqual([3, 4]) // above the old max (2), no deposit row
    expect(rows.map((r: any) => r.amount.toFixed(2))).toEqual(['350.00', '350.00'])
    expect(rows.every((r: any) => r.amount.toFixed(2) !== '600.00')).toBe(true) // deposit not re-scheduled
  })

  it('rejects a reschedule while a capture is in-flight or failed', async () => {
    const { service } = buildHarness(buildBooking(), 2, [
      { sequence: 1, status: 'processing', amount: dec('700.00') },
    ])
    await expect(service.rematerializeForBooking('bg-1', NEW_START, NOW)).rejects.toThrow(
      /in-flight or failed/
    )
  })
})
