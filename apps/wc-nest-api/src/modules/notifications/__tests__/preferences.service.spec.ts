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
  parent: { findUnique: jest.Mock }
  userRole: { findMany: jest.Mock }
  notificationPreference: { findMany: jest.Mock; upsert: jest.Mock }
  $transaction: jest.Mock
}

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService
  let prisma: MockPrisma
  let redis: { isReady: jest.Mock; get: jest.Mock; set: jest.Mock; del: jest.Mock }

  beforeEach(async () => {
    prisma = {
      parent: { findUnique: jest.fn().mockResolvedValue(null) },
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
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
    // Default: Redis is not ready, so the cache short-circuits and every
    // test exercises the compute path. Per-test overrides flip isReady on
    // for cache-specific assertions.
    redis = {
      isReady: jest.fn().mockReturnValue(false),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(true),
    }

    // Import RedisService lazily so the test file doesn't compile-break
    // when the service moves between modules. The DI token is the class.
    const { RedisService } = await import('../../redis/redis.service')
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile()

    service = module.get(NotificationPreferencesService)
    mockedListCatalogEntries.mockReset()
  })

  describe('deriveAudience', () => {
    it('returns "parent" when a Parent row exists for the user', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })

      await expect(service.deriveAudience('u-1')).resolves.toBe('parent')
    })

    it('returns "superadmin" when the user has a system role other than Parent', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce(null)
      prisma.userRole.findMany.mockResolvedValueOnce([
        { role: { name: 'Customer Support', providerId: null } },
      ])

      await expect(service.deriveAudience('u-2')).resolves.toBe('superadmin')
    })

    it('returns "provider" when the user has a provider-scoped role', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce(null)
      prisma.userRole.findMany.mockResolvedValueOnce([
        { role: { name: 'Provider Admin', providerId: 'prov-1' } },
      ])

      await expect(service.deriveAudience('u-3')).resolves.toBe('provider')
    })

    it('returns null for a user with no Parent row and no roles', async () => {
      await expect(service.deriveAudience('u-4')).resolves.toBeNull()
    })

    it('prefers parent over superadmin when both signals are present', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-5' })
      prisma.userRole.findMany.mockResolvedValueOnce([
        { role: { name: 'Customer Support', providerId: null } },
      ])

      await expect(service.deriveAudience('u-5')).resolves.toBe('parent')
    })
  })

  describe('listForUser', () => {
    it('returns an empty list when the user has no audience', async () => {
      mockedListCatalogEntries.mockReturnValue([])

      await expect(service.listForUser('u-1')).resolves.toEqual([])
      // No catalog filtering happens when audience is null.
      expect(prisma.notificationPreference.findMany).not.toHaveBeenCalled()
    })

    it('fans out one row per (templateKey × channel) for the user audience', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
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

      const rows = await service.listForUser('u-1')

      // 2 channels for booking.accepted + 1 for wishlist.priceDrop = 3
      expect(rows).toHaveLength(3)
      const templateKeys = rows.map(r => r.templateKey)
      expect(templateKeys).not.toContain('provider.booking.requestReceived')
    })

    it('marks transactional entries as enabled=true even with an opt-out row present', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
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

      const rows = await service.listForUser('u-1')

      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ enabled: true, transactional: true })
    })

    it('respects opt-out rows for non-transactional entries', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
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

      const rows = await service.listForUser('u-1')

      const emailRow = rows.find(r => r.channel === 'email')
      const inAppRow = rows.find(r => r.channel === 'in_app')
      expect(emailRow?.enabled).toBe(false)
      expect(inAppRow?.enabled).toBe(true)
    })
  })

  describe('bulkSetPreferences', () => {
    it('returns 0 and does nothing when the user has no audience', async () => {
      mockedListCatalogEntries.mockReturnValue([])
      const count = await service.bulkSetPreferences('u-1', [
        { templateKey: 'x', channel: 'in_app', enabled: false },
      ])
      expect(count).toBe(0)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('silently drops items whose templateKey is not in the audience', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      mockedListCatalogEntries.mockReturnValue([
        makeEntry({ templateKey: 'parent.wishlist.priceDrop', audience: 'parent' }),
      ])

      const count = await service.bulkSetPreferences('u-1', [
        { templateKey: 'provider.something', channel: 'in_app', enabled: false },
      ])

      expect(count).toBe(0)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('silently drops transactional items', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      mockedListCatalogEntries.mockReturnValue([
        makeEntry({
          templateKey: 'parent.booking.accepted',
          audience: 'parent',
          transactional: true,
        }),
      ])

      const count = await service.bulkSetPreferences('u-1', [
        { templateKey: 'parent.booking.accepted', channel: 'email', enabled: false },
      ])

      expect(count).toBe(0)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('upserts each valid item in a single transaction', async () => {
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })
      mockedListCatalogEntries.mockReturnValue([
        makeEntry({ templateKey: 'parent.wishlist.priceDrop', audience: 'parent' }),
        makeEntry({ templateKey: 'parent.review.responsePublished', audience: 'parent' }),
      ])

      const count = await service.bulkSetPreferences('u-1', [
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

  describe('deriveAudience cache (Phase 14d)', () => {
    beforeEach(() => {
      redis.isReady.mockReturnValue(true)
    })

    it('returns the cached audience without hitting Prisma on a cache hit', async () => {
      redis.get.mockResolvedValueOnce('provider')

      const result = await service.deriveAudience('u-cache-1')

      expect(result).toBe('provider')
      expect(prisma.parent.findUnique).not.toHaveBeenCalled()
      expect(prisma.userRole.findMany).not.toHaveBeenCalled()
      expect(redis.get).toHaveBeenCalledWith('notif:audience:u-cache-1')
    })

    it('writes the computed audience back to the cache with a 5min TTL on miss', async () => {
      redis.get.mockResolvedValueOnce(null)
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })

      const result = await service.deriveAudience('u-cache-2')

      expect(result).toBe('parent')
      expect(redis.set).toHaveBeenCalledWith('notif:audience:u-cache-2', 'parent', 300)
    })

    it('persists the null-audience sentinel so a "no audience" miss doesn\'t recompute every request', async () => {
      redis.get.mockResolvedValueOnce(null)
      // parent + userRoles both return empty → audience is null.
      prisma.parent.findUnique.mockResolvedValueOnce(null)
      prisma.userRole.findMany.mockResolvedValueOnce([])

      const result = await service.deriveAudience('u-cache-3')

      expect(result).toBeNull()
      expect(redis.set).toHaveBeenCalledWith('notif:audience:u-cache-3', '__none__', 300)
    })

    it('returns null when the cached value is the null-audience sentinel', async () => {
      redis.get.mockResolvedValueOnce('__none__')

      const result = await service.deriveAudience('u-cache-4')

      expect(result).toBeNull()
      expect(prisma.parent.findUnique).not.toHaveBeenCalled()
    })

    it('soft-fails to compute fresh when Redis GET throws', async () => {
      redis.get.mockRejectedValueOnce(new Error('Redis down'))
      prisma.parent.findUnique.mockResolvedValueOnce({ id: 'p-1' })

      await expect(service.deriveAudience('u-cache-5')).resolves.toBe('parent')
      expect(prisma.parent.findUnique).toHaveBeenCalled()
    })

    it('invalidateAudienceCache deletes the per-user key', async () => {
      await service.invalidateAudienceCache('u-cache-6')
      expect(redis.del).toHaveBeenCalledWith('notif:audience:u-cache-6')
    })
  })
})
