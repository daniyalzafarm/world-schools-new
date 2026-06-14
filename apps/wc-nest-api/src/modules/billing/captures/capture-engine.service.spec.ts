import { BookingGroupStatus, ScheduledCaptureStatus } from '../../../generated/client/enums'
import { CaptureEngineService } from './capture-engine.service'

const NOW = new Date('2026-08-10T00:00:00.000Z')
const DUE = new Date('2026-08-09T00:00:00.000Z') // <= NOW
const NOT_DUE = new Date('2026-08-11T00:00:00.000Z') // > NOW

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cap-1',
    bookingGroupId: 'bg-1',
    sequence: 1,
    status: ScheduledCaptureStatus.scheduled,
    effectiveCaptureDate: DUE,
    stripePaymentIntentId: null,
    paymentId: null,
    bookingGroup: {
      status: BookingGroupStatus.provider_accepted,
      respondedAt: new Date('2026-06-01T00:00:00.000Z'),
      depositPaymentIntentId: 'pi_dep_1',
    },
    ...overrides,
  }
}

function buildHarness(row: ReturnType<typeof buildRow> | null) {
  const prisma = {
    bookingScheduledCapture: {
      findUnique: jest.fn().mockResolvedValue(row),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
  }
  const paymentIntents = {
    captureForBookingGroup: jest.fn().mockResolvedValue(['pay-1']),
    chargeScheduledBalanceCapture: jest.fn().mockResolvedValue({
      status: 'succeeded',
      paymentId: 'pay-bal-1',
      stripePaymentIntentId: 'pi_bal_1',
      failureCode: null,
      failureMessage: null,
    }),
  }
  const audit = { appendSafe: jest.fn().mockResolvedValue(undefined), append: jest.fn() }

  const engine = new CaptureEngineService(prisma as any, paymentIntents as any, audit as any)
  return { engine, prisma, paymentIntents, audit }
}

describe('CaptureEngineService.executeCapture — guards', () => {
  it('skips when the row is missing', async () => {
    const { engine } = buildHarness(null)
    expect(await engine.executeCapture('bg-1', 1, NOW)).toEqual({
      status: 'skipped',
      reason: 'capture row not found',
    })
  })

  it('skips when the row is not in scheduled status', async () => {
    const { engine, prisma } = buildHarness(buildRow({ status: ScheduledCaptureStatus.completed }))
    const out = await engine.executeCapture('bg-1', 1, NOW)
    expect(out.status).toBe('skipped')
    expect(prisma.bookingScheduledCapture.updateMany).not.toHaveBeenCalled()
  })

  it('refuses to fire before the provider accepts (no respondedAt)', async () => {
    const { engine, prisma } = buildHarness(
      buildRow({
        bookingGroup: {
          status: BookingGroupStatus.payment_authorized,
          respondedAt: null,
          depositPaymentIntentId: 'pi_dep_1',
        },
      })
    )
    const out = await engine.executeCapture('bg-1', 1, NOW)
    expect(out.status).toBe('skipped')
    expect(prisma.bookingScheduledCapture.updateMany).not.toHaveBeenCalled()
  })

  it('refuses to fire on a non-capture-eligible status', async () => {
    const { engine } = buildHarness(
      buildRow({
        bookingGroup: {
          status: BookingGroupStatus.cancelled,
          respondedAt: new Date(),
          depositPaymentIntentId: null,
        },
      })
    )
    expect((await engine.executeCapture('bg-1', 1, NOW)).status).toBe('skipped')
  })

  it('skips when not yet due', async () => {
    const { engine } = buildHarness(buildRow({ effectiveCaptureDate: NOT_DUE }))
    expect((await engine.executeCapture('bg-1', 1, NOW)).status).toBe('skipped')
  })

  it('skips when another runner has already claimed the row', async () => {
    const { engine, prisma, paymentIntents } = buildHarness(buildRow())
    prisma.bookingScheduledCapture.updateMany.mockResolvedValueOnce({ count: 0 })
    const out = await engine.executeCapture('bg-1', 1, NOW)
    expect(out.status).toBe('skipped')
    expect(paymentIntents.chargeScheduledBalanceCapture).not.toHaveBeenCalled()
  })
})

describe('CaptureEngineService.executeCapture — execution', () => {
  it('captures a deposit (sequence 0) via captureForBookingGroup', async () => {
    const { engine, prisma, paymentIntents, audit } = buildHarness(buildRow({ sequence: 0 }))
    const out = await engine.executeCapture('bg-1', 0, NOW)
    expect(out).toEqual({ status: 'completed' })
    expect(paymentIntents.captureForBookingGroup).toHaveBeenCalledWith('bg-1')
    expect(prisma.bookingScheduledCapture.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ScheduledCaptureStatus.completed,
          stripePaymentIntentId: 'pi_dep_1',
        }),
      })
    )
    expect(audit.appendSafe).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'deposit_captured' })
    )
  })

  it('charges a balance capture (sequence > 0) and completes on success', async () => {
    const { engine, paymentIntents, prisma, audit } = buildHarness(buildRow({ sequence: 2 }))
    const out = await engine.executeCapture('bg-1', 2, NOW)
    expect(out).toEqual({ status: 'completed' })
    expect(paymentIntents.chargeScheduledBalanceCapture).toHaveBeenCalledWith('cap-1')
    expect(prisma.bookingScheduledCapture.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ScheduledCaptureStatus.completed,
          paymentId: 'pay-bal-1',
          stripePaymentIntentId: 'pi_bal_1',
        }),
      })
    )
    expect(audit.appendSafe).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'balance_capture_fired' })
    )
  })

  it('marks a declined balance capture failed with a retry deadline (no throw)', async () => {
    const { engine, paymentIntents, prisma, audit } = buildHarness(buildRow({ sequence: 1 }))
    paymentIntents.chargeScheduledBalanceCapture.mockResolvedValueOnce({
      status: 'failed',
      paymentId: 'pay-bal-1',
      stripePaymentIntentId: null,
      failureCode: 'card_declined',
      failureMessage: 'Your card was declined',
    })
    const out = await engine.executeCapture('bg-1', 1, NOW)
    expect(out.status).toBe('failed')
    const update = prisma.bookingScheduledCapture.update.mock.calls[0][0]
    expect(update.data.status).toBe(ScheduledCaptureStatus.failed)
    expect(update.data.failureCode).toBe('card_declined')
    expect(update.data.retryDeadline).toBeInstanceOf(Date)
    expect(audit.appendSafe).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'balance_capture_failed' })
    )
  })

  it('treats SCA requires_action as a failure to be retried/escalated', async () => {
    const { engine, paymentIntents, prisma } = buildHarness(buildRow({ sequence: 1 }))
    paymentIntents.chargeScheduledBalanceCapture.mockResolvedValueOnce({
      status: 'requires_action',
      paymentId: 'pay-bal-1',
      stripePaymentIntentId: 'pi_bal_1',
      failureCode: null,
      failureMessage: null,
    })
    const out = await engine.executeCapture('bg-1', 1, NOW)
    expect(out.status).toBe('failed')
    expect(prisma.bookingScheduledCapture.update.mock.calls[0][0].data.status).toBe(
      ScheduledCaptureStatus.failed
    )
  })

  it('records a thrown (transient/stale-auth) error as failed', async () => {
    const { engine, paymentIntents, prisma } = buildHarness(buildRow({ sequence: 0 }))
    paymentIntents.captureForBookingGroup.mockRejectedValueOnce(
      Object.assign(new Error('authorization expired'), { code: 'payment_intent_unexpected_state' })
    )
    const out = await engine.executeCapture('bg-1', 0, NOW)
    expect(out.status).toBe('failed')
    expect(prisma.bookingScheduledCapture.update.mock.calls[0][0].data.failureCode).toBe(
      'payment_intent_unexpected_state'
    )
  })
})
