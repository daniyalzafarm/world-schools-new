import { Test, type TestingModule } from '@nestjs/testing'
import { NotificationType } from '@world-schools/wc-types'
import { PrismaService } from '../../../prisma/prisma.service'
import { NotificationDispatcherService } from '../dispatcher/notification-dispatcher.service'
import { NotificationsEnqueueService } from '../queue/enqueue.service'
import { NotificationPreferencesService } from '../preferences/notification-preferences.service'
import { NotificationsMetricsService } from '../observability/notifications-metrics.service'
import { getCatalogEntry } from '../catalog/notification-catalog'
import { getResolver } from '../resolvers/recipient-resolvers'

jest.mock('../catalog/notification-catalog', () => ({
  getCatalogEntry: jest.fn(),
}))
jest.mock('../resolvers/recipient-resolvers', () => ({
  getResolver: jest.fn(),
}))

const mockedGetCatalogEntry = getCatalogEntry as jest.MockedFunction<typeof getCatalogEntry>
const mockedGetResolver = getResolver as jest.MockedFunction<typeof getResolver>

function makeEntry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    type: NotificationType.ParentBookingAccepted,
    templateKey: 'parent.booking.accepted',
    audience: 'parent',
    category: 'booking',
    channels: ['in_app', 'email'] as Array<'in_app' | 'email'>,
    salutation: 'hi',
    resolver: 'parentForBooking',
    transactional: true,
    trigger: 'live',
    loadProps: jest.fn(),
    inApp: { entityType: 'BookingGroup', entityId: () => 'BG-1' },
    ...overrides,
  } as never
}

describe('NotificationDispatcherService', () => {
  let service: NotificationDispatcherService
  let enqueueService: { enqueue: jest.Mock }
  let preferences: { filterChannels: jest.Mock }
  let metrics: { recordZeroRecipientTransactional: jest.Mock }

  beforeEach(async () => {
    enqueueService = { enqueue: jest.fn().mockResolvedValue(undefined) }
    preferences = { filterChannels: jest.fn() }
    metrics = { recordZeroRecipientTransactional: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDispatcherService,
        { provide: PrismaService, useValue: {} },
        { provide: NotificationsEnqueueService, useValue: enqueueService },
        { provide: NotificationPreferencesService, useValue: preferences },
        { provide: NotificationsMetricsService, useValue: metrics },
      ],
    }).compile()

    service = module.get(NotificationDispatcherService)
    mockedGetCatalogEntry.mockReset()
    mockedGetResolver.mockReset()
  })

  it('skips dispatch when no catalog entry matches the type', async () => {
    mockedGetCatalogEntry.mockReturnValue(undefined)

    await service.dispatch({
      type: NotificationType.ParentBookingAccepted,
      context: { bookingGroupId: 'BG-1' },
    })

    expect(mockedGetResolver).not.toHaveBeenCalled()
    expect(enqueueService.enqueue).not.toHaveBeenCalled()
  })

  it('skips dispatch when resolver returns no recipients', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry())
    mockedGetResolver.mockReturnValue(jest.fn().mockResolvedValue([]))

    await service.dispatch({
      type: NotificationType.ParentBookingAccepted,
      context: { bookingGroupId: 'BG-1' },
    })

    expect(enqueueService.enqueue).not.toHaveBeenCalled()
    expect(preferences.filterChannels).not.toHaveBeenCalled()
  })

  it('bypasses preference filtering for transactional entries', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry({ transactional: true }))
    mockedGetResolver.mockReturnValue(jest.fn().mockResolvedValue(['user-1']))

    await service.dispatch({
      type: NotificationType.ParentBookingAccepted,
      context: { bookingGroupId: 'BG-1' },
    })

    expect(preferences.filterChannels).not.toHaveBeenCalled()
    expect(enqueueService.enqueue).toHaveBeenCalledTimes(1)
    expect(enqueueService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.ParentBookingAccepted,
        recipientUserId: 'user-1',
        channels: ['in_app', 'email'],
        context: { bookingGroupId: 'BG-1' },
        dedupeKey: 'user-1:BG-1',
        delay: 0,
      })
    )
  })

  it('applies preference filtering for non-transactional entries', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry({ transactional: false }))
    mockedGetResolver.mockReturnValue(jest.fn().mockResolvedValue(['user-1']))
    preferences.filterChannels.mockResolvedValue(['in_app']) // user opted out of email

    await service.dispatch({
      type: NotificationType.ParentBookingAccepted,
      context: { bookingGroupId: 'BG-1' },
    })

    expect(preferences.filterChannels).toHaveBeenCalledWith('user-1', 'parent.booking.accepted', [
      'in_app',
      'email',
    ])
    expect(enqueueService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'user-1',
        channels: ['in_app'],
      })
    )
  })

  it('skips enqueue when preference filter returns empty channels', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry({ transactional: false }))
    mockedGetResolver.mockReturnValue(jest.fn().mockResolvedValue(['user-1']))
    preferences.filterChannels.mockResolvedValue([])

    await service.dispatch({
      type: NotificationType.ParentBookingAccepted,
      context: { bookingGroupId: 'BG-1' },
    })

    expect(enqueueService.enqueue).not.toHaveBeenCalled()
  })

  it('uses a custom dedupeKey when the catalog entry provides one', async () => {
    mockedGetCatalogEntry.mockReturnValue(
      makeEntry({
        dedupeKey: (uid: string, ctx: { bookingGroupId?: string }) =>
          `custom:${uid}:${ctx.bookingGroupId}:v2`,
      })
    )
    mockedGetResolver.mockReturnValue(jest.fn().mockResolvedValue(['user-1']))

    await service.dispatch({
      type: NotificationType.ParentBookingAccepted,
      context: { bookingGroupId: 'BG-1' },
    })

    expect(enqueueService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKey: 'custom:user-1:BG-1:v2' })
    )
  })

  it('computes delay from runAt for scheduled triggers', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry())
    mockedGetResolver.mockReturnValue(jest.fn().mockResolvedValue(['user-1']))

    const futureAt = new Date(Date.now() + 60_000) // 60s in the future
    await service.dispatch({
      type: NotificationType.ParentBookingAccepted,
      context: { bookingGroupId: 'BG-1' },
      runAt: futureAt,
    })

    const call = enqueueService.enqueue.mock.calls[0][0]
    expect(call.delay).toBeGreaterThan(50_000)
    expect(call.delay).toBeLessThanOrEqual(60_000)
  })

  it('clamps delay to 0 when runAt is in the past', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry())
    mockedGetResolver.mockReturnValue(jest.fn().mockResolvedValue(['user-1']))

    const pastAt = new Date(Date.now() - 60_000)
    await service.dispatch({
      type: NotificationType.ParentBookingAccepted,
      context: { bookingGroupId: 'BG-1' },
      runAt: pastAt,
    })

    expect(enqueueService.enqueue).toHaveBeenCalledWith(expect.objectContaining({ delay: 0 }))
  })

  it('enqueues one job per recipient when the resolver returns multiple', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry())
    mockedGetResolver.mockReturnValue(jest.fn().mockResolvedValue(['user-1', 'user-2', 'user-3']))

    await service.dispatch({
      type: NotificationType.ParentBookingAccepted,
      context: { bookingGroupId: 'BG-1' },
    })

    expect(enqueueService.enqueue).toHaveBeenCalledTimes(3)
    const ids = enqueueService.enqueue.mock.calls.map(c => c[0].recipientUserId)
    expect(ids).toEqual(['user-1', 'user-2', 'user-3'])
  })

  it('falls back to defaultDedupeKey "global" when no entity id in context', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry())
    mockedGetResolver.mockReturnValue(jest.fn().mockResolvedValue(['user-1']))

    await service.dispatch({
      type: NotificationType.ParentBookingAccepted,
      context: {}, // no IDs at all
    })

    expect(enqueueService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKey: 'user-1:global' })
    )
  })

  it('de-duplicates the resolver output before enqueueing (catches resolver bugs)', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry())
    // Same user appears three times — resolver bug.
    mockedGetResolver.mockReturnValue(jest.fn().mockResolvedValue(['user-1', 'user-1', 'user-1']))

    await service.dispatch({
      type: NotificationType.ParentBookingAccepted,
      context: { bookingGroupId: 'BG-1' },
    })

    expect(enqueueService.enqueue).toHaveBeenCalledTimes(1)
  })

  it('records the zero-recipient-transactional metric when a transactional resolves nobody', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry({ transactional: true }))
    mockedGetResolver.mockReturnValue(jest.fn().mockResolvedValue([]))

    await service.dispatch({
      type: NotificationType.ParentBookingAccepted,
      context: { bookingGroupId: 'BG-1' },
    })

    expect(metrics.recordZeroRecipientTransactional).toHaveBeenCalledTimes(1)
  })

  it('does NOT record zero-recipient metric for non-transactional notifications', async () => {
    mockedGetCatalogEntry.mockReturnValue(makeEntry({ transactional: false }))
    mockedGetResolver.mockReturnValue(jest.fn().mockResolvedValue([]))

    await service.dispatch({
      type: NotificationType.ParentBookingAccepted,
      context: { bookingGroupId: 'BG-1' },
    })

    expect(metrics.recordZeroRecipientTransactional).not.toHaveBeenCalled()
  })
})
