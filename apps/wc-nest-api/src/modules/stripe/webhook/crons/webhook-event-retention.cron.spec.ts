import { WebhookEventRetentionCron } from './webhook-event-retention.cron'

/**
 * 10-year retention guard (Payments revamp, Spec v2.3 §9 / Swiss CO Art. 958f).
 *
 * The 90-day webhook-event purge MUST NOT touch the append-only payment audit
 * log or the consent snapshots — those are retained for 10 years. This test
 * pins that the cron only ever deletes from `stripe_webhook_events`.
 */
describe('WebhookEventRetentionCron — retention guard', () => {
  function build(retentionDays = 90) {
    const prisma = {
      stripeWebhookEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      // The 10-year tables — the cron must NEVER call delete/find on these.
      bookingPaymentAuditLog: { deleteMany: jest.fn(), findMany: jest.fn() },
      bookingConsentSnapshot: { deleteMany: jest.fn(), findMany: jest.fn() },
    }
    const configService = { stripeConfig: { webhookEventRetentionDays: retentionDays } }
    const cron = new WebhookEventRetentionCron(prisma as any, {} as any, configService as any)
    return { cron, prisma }
  }

  it('purges ONLY stripe_webhook_events — never the audit log or consent snapshots', async () => {
    const { cron, prisma } = build()
    prisma.stripeWebhookEvent.findMany
      .mockResolvedValueOnce([{ id: 'e1' }])
      .mockResolvedValueOnce([])

    await cron.runBatch()

    expect(prisma.stripeWebhookEvent.deleteMany).toHaveBeenCalled()
    expect(prisma.bookingPaymentAuditLog.deleteMany).not.toHaveBeenCalled()
    expect(prisma.bookingPaymentAuditLog.findMany).not.toHaveBeenCalled()
    expect(prisma.bookingConsentSnapshot.deleteMany).not.toHaveBeenCalled()
    expect(prisma.bookingConsentSnapshot.findMany).not.toHaveBeenCalled()
  })

  it('deletes webhook events older than the configured horizon', async () => {
    const { cron, prisma } = build(90)
    prisma.stripeWebhookEvent.findMany
      .mockResolvedValueOnce([{ id: 'e1' }])
      .mockResolvedValueOnce([])

    await cron.runBatch()

    const where = prisma.stripeWebhookEvent.findMany.mock.calls[0][0].where
    expect(where.receivedAt.lt).toBeInstanceOf(Date)
    // ~90 days back from now.
    const cutoff = where.receivedAt.lt as Date
    const daysBack = (Date.now() - cutoff.getTime()) / (24 * 60 * 60 * 1000)
    expect(daysBack).toBeGreaterThan(89)
    expect(daysBack).toBeLessThan(91)
  })

  it('is a no-op when retention is disabled (days=0) — nothing is ever deleted', async () => {
    const { cron, prisma } = build(0)
    const result = await cron.runBatch()
    expect(result).toEqual({ deleted: 0 })
    expect(prisma.stripeWebhookEvent.deleteMany).not.toHaveBeenCalled()
    expect(prisma.bookingPaymentAuditLog.deleteMany).not.toHaveBeenCalled()
  })
})
