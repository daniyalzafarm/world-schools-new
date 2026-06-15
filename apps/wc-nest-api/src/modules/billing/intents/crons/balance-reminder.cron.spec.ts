import { NotificationType } from '@world-schools/wc-types'
import { NOTIFICATION_DISPATCH_EVENT } from '../../../notifications/dispatcher/notify'
import { BalanceReminderCron } from './balance-reminder.cron'

/**
 * Payments revamp (Spec v2.3): the reminder cron reads forward-dated SCHEDULED
 * CAPTURES, not `Payment.dueAt` (balance Payment rows only exist once the engine
 * fires the capture). These tests pin that re-sourcing.
 */
describe('BalanceReminderCron', () => {
  function build(captures: Array<{ bookingGroupId: string; sequence: number }>) {
    const prisma: any = {
      bookingScheduledCapture: {
        findMany: jest.fn().mockImplementation(() =>
          Promise.resolve(
            captures.map(c => ({
              bookingGroupId: c.bookingGroupId,
              amount: '700.00',
              currency: 'eur',
              effectiveCaptureDate: new Date('2026-09-01T00:00:00.000Z'),
            }))
          )
        ),
      },
    }
    const redisClient = { set: jest.fn().mockResolvedValue('OK'), del: jest.fn() }
    const redis = { isReady: () => true, getClient: () => redisClient, del: jest.fn() }
    const eventEmitter = { emit: jest.fn() }
    const cron = new BalanceReminderCron(prisma as any, redis as any, eventEmitter as any)
    return { cron, prisma, eventEmitter }
  }

  it('queries scheduled balance captures (status=scheduled, sequence>0) per tier window', async () => {
    const { cron, prisma } = build([{ bookingGroupId: 'bg-1', sequence: 1 }])
    await cron.run()

    // One findMany per tier (14d / 7d / 3d).
    expect(prisma.bookingScheduledCapture.findMany).toHaveBeenCalledTimes(3)
    const where = prisma.bookingScheduledCapture.findMany.mock.calls[0][0].where
    expect(where.status).toBe('scheduled')
    expect(where.sequence).toEqual({ gt: 0 }) // deposit (seq 0) excluded
    expect(where.effectiveCaptureDate.gte).toBeInstanceOf(Date)
    expect(where.effectiveCaptureDate.lt).toBeInstanceOf(Date)
  })

  it('emits a parent reminder carrying the specific capture amount + date via extra', async () => {
    const { cron, eventEmitter } = build([{ bookingGroupId: 'bg-1', sequence: 2 }])
    await cron.run()

    // 3 tiers × 1 candidate = 3 dispatch events.
    const dispatches = eventEmitter.emit.mock.calls.filter(
      ([name]) => name === NOTIFICATION_DISPATCH_EVENT
    )
    expect(dispatches.length).toBe(3)
    const { type, context } = dispatches[0][1]
    expect([
      NotificationType.ParentPaymentBalanceReminder14d,
      NotificationType.ParentPaymentBalanceReminder7d,
      NotificationType.ParentPaymentBalanceReminder3d,
    ]).toContain(type)
    expect(context.bookingGroupId).toBe('bg-1')
    expect(context.extra.captureAmount).toBe('700.00')
    expect(context.extra.captureCurrency).toBe('eur')
    expect(typeof context.extra.captureDate).toBe('string')
  })

  it('no-ops when no captures fall in any tier window', async () => {
    const { cron, eventEmitter } = build([])
    await cron.run()
    const dispatches = eventEmitter.emit.mock.calls.filter(
      ([name]) => name === NOTIFICATION_DISPATCH_EVENT
    )
    expect(dispatches.length).toBe(0)
  })
})
