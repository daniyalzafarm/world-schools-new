import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '../../../prisma/prisma.service'
import { NotificationPreferencesService } from '../preferences/notification-preferences.service'
import { listCatalogEntries } from '../catalog/notification-catalog'

jest.mock('../catalog/notification-catalog', () => ({
  listCatalogEntries: jest.fn(),
}))

const mockedListCatalogEntries = listCatalogEntries as jest.MockedFunction<
  typeof listCatalogEntries
>

function makeEntry(opts: {
  templateKey: string
  audience: 'parent' | 'provider' | 'superadmin'
  channels?: Array<'in_app' | 'email'>
  transactional?: boolean
  category?: string
}) {
  return {
    type: opts.templateKey,
    templateKey: opts.templateKey,
    audience: opts.audience,
    category: opts.category ?? 'booking',
    channels: opts.channels ?? ['in_app', 'email'],
    salutation: 'hi',
    resolver: 'parentForBooking',
    transactional: opts.transactional ?? false,
    trigger: 'live',
    loadProps: jest.fn(),
  } as never
}

interface MockPrisma {
  notificationPreference: { findMany: jest.Mock; upsert: jest.Mock }
  $transaction: jest.Mock
}

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService
  let prisma: MockPrisma

  beforeEach(async () => {
    prisma = {
      notificationPreference: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue(undefined),
      },
      $transaction: jest.fn(async (ops: unknown) => {
        // The service passes an array of upsert promises; resolve them all.
        if (Array.isArray(ops)) return Promise.all(ops)
        return undefined
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationPreferencesService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get(NotificationPreferencesService)
    mockedListCatalogEntries.mockReset()
  })

  // The audience is supplied by the app-prefixed controller (and enforced by
  // the JWT `payload.app` claim), so the service takes it as a parameter — no
  // role-based derivation here.
  describe('listForUser', () => {
    it('fans out one row per (templateKey × channel) for the given audience', async () => {
      mockedListCatalogEntries.mockReturnValue([
        makeEntry({
          templateKey: 'parent.booking.accepted',
          audience: 'parent',
          channels: ['in_app', 'email'],
          transactional: true,
        }),
        makeEntry({
          templateKey: 'parent.wishlist.priceDrop',
          audience: 'parent',
          channels: ['in_app'],
        }),
        // This one should be filtered out — wrong audience.
        makeEntry({
          templateKey: 'provider.booking.requestReceived',
          audience: 'provider',
        }),
      ])

      const rows = await service.listForUser('u-1', 'parent')

      // 2 channels for booking.accepted + 1 for wishlist.priceDrop = 3
      expect(rows).toHaveLength(3)
      const templateKeys = rows.map(r => r.templateKey)
      expect(templateKeys).not.toContain('provider.booking.requestReceived')
    })

    it('filters entries to the requested audience (provider sees only provider rows)', async () => {
      mockedListCatalogEntries.mockReturnValue([
        makeEntry({ templateKey: 'parent.wishlist.priceDrop', audience: 'parent' }),
        makeEntry({
          templateKey: 'provider.booking.requestReceived',
          audience: 'provider',
          channels: ['in_app'],
        }),
      ])

      const rows = await service.listForUser('u-1', 'provider')

      expect(rows.map(r => r.templateKey)).toEqual(['provider.booking.requestReceived'])
    })

    it('marks transactional entries as enabled=true even with an opt-out row present', async () => {
      mockedListCatalogEntries.mockReturnValue([
        makeEntry({
          templateKey: 'parent.booking.accepted',
          audience: 'parent',
          channels: ['email'],
          transactional: true,
        }),
      ])
      // Opt-out row exists but should be IGNORED for transactional entries.
      prisma.notificationPreference.findMany.mockResolvedValueOnce([
        { templateKey: 'parent.booking.accepted', channel: 'email' },
      ])

      const rows = await service.listForUser('u-1', 'parent')

      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ enabled: true, transactional: true })
    })

    it('respects opt-out rows for non-transactional entries', async () => {
      mockedListCatalogEntries.mockReturnValue([
        makeEntry({
          templateKey: 'parent.wishlist.priceDrop',
          audience: 'parent',
          channels: ['in_app', 'email'],
          transactional: false,
        }),
      ])
      prisma.notificationPreference.findMany.mockResolvedValueOnce([
        { templateKey: 'parent.wishlist.priceDrop', channel: 'email' }, // opted out of email
      ])

      const rows = await service.listForUser('u-1', 'parent')

      const emailRow = rows.find(r => r.channel === 'email')
      const inAppRow = rows.find(r => r.channel === 'in_app')
      expect(emailRow?.enabled).toBe(false)
      expect(inAppRow?.enabled).toBe(true)
    })
  })

  describe('bulkSetPreferences', () => {
    it('silently drops items whose templateKey is not in the audience', async () => {
      mockedListCatalogEntries.mockReturnValue([
        makeEntry({ templateKey: 'parent.wishlist.priceDrop', audience: 'parent' }),
      ])

      const count = await service.bulkSetPreferences('u-1', 'parent', [
        { templateKey: 'provider.something', channel: 'in_app', enabled: false },
      ])

      expect(count).toBe(0)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('silently drops items that belong to a different audience', async () => {
      mockedListCatalogEntries.mockReturnValue([
        makeEntry({ templateKey: 'parent.wishlist.priceDrop', audience: 'parent' }),
        makeEntry({ templateKey: 'provider.messaging.newFromFamily', audience: 'provider' }),
      ])

      // Provider audience + a parent templateKey → dropped.
      const count = await service.bulkSetPreferences('u-1', 'provider', [
        { templateKey: 'parent.wishlist.priceDrop', channel: 'in_app', enabled: false },
      ])

      expect(count).toBe(0)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('silently drops transactional items', async () => {
      mockedListCatalogEntries.mockReturnValue([
        makeEntry({
          templateKey: 'parent.booking.accepted',
          audience: 'parent',
          transactional: true,
        }),
      ])

      const count = await service.bulkSetPreferences('u-1', 'parent', [
        { templateKey: 'parent.booking.accepted', channel: 'email', enabled: false },
      ])

      expect(count).toBe(0)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('upserts each valid item in a single transaction', async () => {
      mockedListCatalogEntries.mockReturnValue([
        makeEntry({ templateKey: 'parent.wishlist.priceDrop', audience: 'parent' }),
        makeEntry({ templateKey: 'parent.review.responsePublished', audience: 'parent' }),
      ])

      const count = await service.bulkSetPreferences('u-1', 'parent', [
        { templateKey: 'parent.wishlist.priceDrop', channel: 'email', enabled: false },
        { templateKey: 'parent.review.responsePublished', channel: 'in_app', enabled: false },
      ])

      expect(count).toBe(2)
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(prisma.notificationPreference.upsert).toHaveBeenCalledTimes(2)
    })
  })

  describe('filterChannels', () => {
    it('returns the full set of channels when there are no opt-out rows', async () => {
      const filtered = await service.filterChannels('u-1', 'parent.wishlist.priceDrop', [
        'in_app',
        'email',
      ])
      expect(filtered).toEqual(['in_app', 'email'])
    })

    it('excludes channels with explicit enabled=false rows', async () => {
      prisma.notificationPreference.findMany.mockResolvedValueOnce([
        { channel: 'email', enabled: false },
      ])
      const filtered = await service.filterChannels('u-1', 'parent.wishlist.priceDrop', [
        'in_app',
        'email',
      ])
      expect(filtered).toEqual(['in_app'])
    })

    it('falls back to all channels enabled when the lookup throws (defensive)', async () => {
      prisma.notificationPreference.findMany.mockRejectedValueOnce(new Error('db down'))
      const filtered = await service.filterChannels('u-1', 'parent.wishlist.priceDrop', [
        'in_app',
        'email',
      ])
      expect(filtered).toEqual(['in_app', 'email'])
    })
  })

  describe('setPreference', () => {
    it('upserts a single row by composite (userId, templateKey, channel) key', async () => {
      await service.setPreference('u-1', 'parent.wishlist.priceDrop', 'email', false)

      expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_templateKey_channel: {
              userId: 'u-1',
              templateKey: 'parent.wishlist.priceDrop',
              channel: 'email',
            },
          },
          create: expect.objectContaining({ enabled: false }),
          update: { enabled: false },
        })
      )
    })
  })
})
