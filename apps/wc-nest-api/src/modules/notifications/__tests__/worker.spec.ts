import type { Job } from 'bullmq'
import { NotificationType } from '@world-schools/wc-types'
import { NotificationLiveWorker } from '../workers/notification.worker'
import { getCatalogEntry } from '../catalog/notification-catalog'
import type { NotificationJobData } from '../queue/queue.types'

jest.mock('../catalog/notification-catalog', () => ({
  getCatalogEntry: jest.fn(),
}))
jest.mock('@world-schools/wc-email-templates', () => ({
  renderEmail: jest.fn().mockResolvedValue({ html: '<html>rendered</html>', text: 'plain text' }),
}))

const mockedGetCatalogEntry = getCatalogEntry as jest.MockedFunction<typeof getCatalogEntry>

interface MockProps {
  bookingRef: string
  campName: string
  childName: string
}

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    type: NotificationType.ParentBookingAccepted,
    templateKey: 'parent.booking.accepted',
    audience: 'parent',
    category: 'booking',
    channels: ['in_app', 'email'],
    salutation: 'hi',
    resolver: 'parentForBooking',
    transactional: true,
    trigger: 'live',
    loadProps: jest.fn().mockResolvedValue({
      bookingRef: 'BG-1',
      campName: 'Summer Camp',
      childName: 'Alex',
    } as MockProps),
    email: {
      component: function MockComponent() {
        return null
      } as never,
      subject: (p: MockProps) => `Subject for ${p.campName}`,
      includePlainText: true,
    },
    inApp: {
      title: (p: MockProps) => `Title for ${p.campName}`,
      body: (p: MockProps) => `Body for ${p.childName}`,
      entityType: 'BookingGroup',
      entityId: (p: MockProps) => p.bookingRef,
      redirectUrl: (p: MockProps) => `/bookings/${p.bookingRef}`,
      metadata: (p: MockProps) => ({ campName: p.campName }),
    },
    ...overrides,
  } as never
}

function makeJob(overrides: Partial<NotificationJobData> = {}): Job<NotificationJobData> {
  return {
    id: 'job-1',
    attemptsMade: 0,
    data: {
      type: NotificationType.ParentBookingAccepted,
      recipientUserId: 'user-1',
      channels: ['in_app', 'email'],
      context: { bookingGroupId: 'BG-1' },
      enqueuedAt: new Date().toISOString(),
      dedupeKey: 'user-1:BG-1',
      source: 'live',
      ...overrides,
    },
  } as Job<NotificationJobData>
}

interface MockPrisma {
  user: { findUnique: jest.Mock }
  notificationDelivery: { findUnique: jest.Mock; upsert: jest.Mock }
}

function makePrismaMock(): MockPrisma {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({ email: 'parent@example.com', firstName: 'Parent' }),
    },
    notificationDelivery: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    },
  }
}

interface MockMetrics {
  recordEnqueued: jest.Mock
  recordSent: jest.Mock
  recordFailed: jest.Mock
  recordSkipped: jest.Mock
  recordZeroRecipientTransactional: jest.Mock
  recordCronRun: jest.Mock
  snapshot: jest.Mock
}

function makeMetricsMock(): MockMetrics {
  return {
    recordEnqueued: jest.fn(),
    recordSent: jest.fn(),
    recordFailed: jest.fn(),
    recordSkipped: jest.fn(),
    recordZeroRecipientTransactional: jest.fn(),
    recordCronRun: jest.fn(),
    snapshot: jest.fn(),
  }
}

describe('NotificationLiveWorker.process (runNotificationJob)', () => {
  let prisma: MockPrisma
  let notificationsService: { create: jest.Mock }
  let emailService: { sendEmail: jest.Mock }
  let metrics: MockMetrics
  let worker: NotificationLiveWorker

  beforeEach(() => {
    prisma = makePrismaMock()
    notificationsService = { create: jest.fn().mockResolvedValue(undefined) }
    emailService = { sendEmail: jest.fn().mockResolvedValue(undefined) }
    metrics = makeMetricsMock()
    worker = new NotificationLiveWorker(
      prisma as never,
      notificationsService as never,
      emailService as never,
      metrics as never
    )
    mockedGetCatalogEntry.mockReset()
  })

  it('throws permanently when no catalog entry exists for the job type', async () => {
    mockedGetCatalogEntry.mockReturnValue(undefined)

    await expect(worker.process(makeJob())).rejects.toThrow(/No catalog entry/)
    expect(prisma.notificationDelivery.upsert).not.toHaveBeenCalled()
    expect(emailService.sendEmail).not.toHaveBeenCalled()
  })

  it('dispatches in-app + email and writes one "sent" delivery per channel', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry())

    await worker.process(makeJob())

    expect(notificationsService.create).toHaveBeenCalledTimes(1)
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: NotificationType.ParentBookingAccepted,
        title: 'Title for Summer Camp',
        body: 'Body for Alex',
        entityType: 'BookingGroup',
        entityId: 'BG-1',
        metadata: { campName: 'Summer Camp', redirectUrl: '/bookings/BG-1' },
      })
    )

    expect(emailService.sendEmail).toHaveBeenCalledTimes(1)
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'parent@example.com',
        subject: 'Subject for Summer Camp',
        html: '<html>rendered</html>',
        text: 'plain text',
        messageId: 'user-1:BG-1@worldcamps',
      })
    )

    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledTimes(2)
    const statuses = prisma.notificationDelivery.upsert.mock.calls.map(c => c[0].create.status)
    expect(statuses).toEqual(['sent', 'sent'])
  })

  it('skips dispatch when an existing delivery row is already sent (dedupe hit)', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry({ channels: ['in_app'] }))
    prisma.notificationDelivery.findUnique.mockResolvedValueOnce({ id: 'd-1', status: 'sent' })

    await worker.process(makeJob({ channels: ['in_app'] }))

    expect(notificationsService.create).not.toHaveBeenCalled()
    expect(prisma.notificationDelivery.upsert).not.toHaveBeenCalled()
  })

  it('writes a "skipped" delivery when loadProps returns null', async () => {
    const entry = makeEntry({ channels: ['in_app'], loadProps: jest.fn().mockResolvedValue(null) })
    mockedGetCatalogEntry.mockReturnValue(entry)

    await worker.process(makeJob({ channels: ['in_app'] }))

    expect(notificationsService.create).not.toHaveBeenCalled()
    expect(emailService.sendEmail).not.toHaveBeenCalled()
    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: 'skipped',
          errorMessage: 'loadProps returned null',
        }),
      })
    )
  })

  it('skips the email channel and writes "skipped" when the recipient has no email', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry({ channels: ['email'] }))
    prisma.user.findUnique.mockResolvedValueOnce({ email: null, firstName: 'Parent' })

    await worker.process(makeJob({ channels: ['email'] }))

    expect(emailService.sendEmail).not.toHaveBeenCalled()
    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          channel: 'email',
          status: 'skipped',
          errorMessage: 'recipient has no email address',
        }),
      })
    )
  })

  it('marks delivery "failed" and re-throws when emailService.sendEmail throws (BullMQ will retry)', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry({ channels: ['email'] }))
    emailService.sendEmail.mockRejectedValueOnce(new Error('SMTP timeout'))

    await expect(worker.process(makeJob({ channels: ['email'] }))).rejects.toThrow('SMTP timeout')

    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          channel: 'email',
          status: 'failed',
          errorMessage: 'SMTP timeout',
          attempt: 1,
        }),
      })
    )
  })

  it('marks delivery "failed" and re-throws when notificationsService.create throws', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry({ channels: ['in_app'] }))
    notificationsService.create.mockRejectedValueOnce(new Error('Prisma connection'))

    await expect(worker.process(makeJob({ channels: ['in_app'] }))).rejects.toThrow(
      'Prisma connection'
    )

    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          channel: 'in_app',
          status: 'failed',
          errorMessage: 'Prisma connection',
        }),
      })
    )
  })

  it('records job attempt number on failure (attemptsMade + 1)', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry({ channels: ['email'] }))
    emailService.sendEmail.mockRejectedValueOnce(new Error('fail'))

    const job = makeJob({ channels: ['email'] })
    ;(job as { attemptsMade: number }).attemptsMade = 3

    await expect(worker.process(job)).rejects.toThrow('fail')

    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ attempt: 4 }),
      })
    )
  })

  it('populates entityType + entityId on delivery rows from inApp.entityId(props)', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry())

    await worker.process(makeJob())

    for (const call of prisma.notificationDelivery.upsert.mock.calls) {
      expect(call[0].create).toMatchObject({
        entityType: 'BookingGroup',
        entityId: 'BG-1',
      })
    }
  })

  it('does not fetch recipient when no email channel is requested', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry({ channels: ['in_app'] }))

    await worker.process(makeJob({ channels: ['in_app'] }))

    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  describe('metrics integration', () => {
    it('records a "sent" metric per successfully dispatched channel', async () => {
      mockedGetCatalogEntry.mockReturnValue(makeEntry())

      await worker.process(makeJob())

      expect(metrics.recordSent).toHaveBeenCalledTimes(2)
      expect(metrics.recordSent).toHaveBeenCalledWith('in_app')
      expect(metrics.recordSent).toHaveBeenCalledWith('email')
      expect(metrics.recordFailed).not.toHaveBeenCalled()
      expect(metrics.recordSkipped).not.toHaveBeenCalled()
    })

    it('records a "failed" metric (non-terminal) when sendEmail throws', async () => {
      mockedGetCatalogEntry.mockReturnValue(makeEntry({ channels: ['email'] }))
      emailService.sendEmail.mockRejectedValueOnce(new Error('SMTP down'))

      await expect(worker.process(makeJob({ channels: ['email'] }))).rejects.toThrow('SMTP down')

      expect(metrics.recordFailed).toHaveBeenCalledTimes(1)
      // Terminal flag is set by the QueueEvents listener, not the worker.
      expect(metrics.recordFailed).toHaveBeenCalledWith('email')
    })

    it('records a "skipped" metric when loadProps returns null', async () => {
      mockedGetCatalogEntry.mockReturnValue(
        makeEntry({ channels: ['in_app'], loadProps: jest.fn().mockResolvedValue(null) })
      )

      await worker.process(makeJob({ channels: ['in_app'] }))

      expect(metrics.recordSkipped).toHaveBeenCalledWith('in_app')
      expect(metrics.recordSent).not.toHaveBeenCalled()
    })
  })

  describe('loader-throws hardening', () => {
    it('writes a "failed" delivery row per requested channel when loadProps throws', async () => {
      mockedGetCatalogEntry.mockReturnValue(
        makeEntry({
          channels: ['in_app', 'email'],
          loadProps: jest.fn().mockRejectedValue(new Error('Prisma pool exhausted')),
        })
      )

      await expect(worker.process(makeJob())).rejects.toThrow('Prisma pool exhausted')

      // One row per channel — both written before the throw propagates.
      expect(prisma.notificationDelivery.upsert).toHaveBeenCalledTimes(2)
      for (const call of prisma.notificationDelivery.upsert.mock.calls) {
        expect(call[0].create.status).toBe('failed')
        expect(call[0].create.errorMessage).toBe('loadProps: Prisma pool exhausted')
      }
      // Per-channel failure metric bumped.
      expect(metrics.recordFailed).toHaveBeenCalledWith('in_app')
      expect(metrics.recordFailed).toHaveBeenCalledWith('email')
    })

    it('sanitises a multi-line error to its first line before persisting it', async () => {
      mockedGetCatalogEntry.mockReturnValue(makeEntry({ channels: ['email'] }))
      const stacky = new Error(
        'SMTP auth failed: secret-token-xyz\n  at smtp.send (line 42)\n  at next (line 99)'
      )
      emailService.sendEmail.mockRejectedValueOnce(stacky)

      await expect(worker.process(makeJob({ channels: ['email'] }))).rejects.toThrow()

      const upsert = prisma.notificationDelivery.upsert.mock.calls[0][0]
      // Only the first line; no stack lines present.
      expect(upsert.create.errorMessage).toBe('SMTP auth failed: secret-token-xyz')
      expect(upsert.create.errorMessage).not.toContain('\n')
      expect(upsert.create.errorMessage).not.toContain('at smtp')
    })

    it('caps errorMessage at 500 chars for runaway provider strings', async () => {
      mockedGetCatalogEntry.mockReturnValue(makeEntry({ channels: ['email'] }))
      const huge = new Error('x'.repeat(1200))
      emailService.sendEmail.mockRejectedValueOnce(huge)

      await expect(worker.process(makeJob({ channels: ['email'] }))).rejects.toThrow()

      const upsert = prisma.notificationDelivery.upsert.mock.calls[0][0]
      expect(upsert.create.errorMessage.length).toBe(500)
    })
  })
})
