import { Injectable, Logger } from '@nestjs/common'
import type { NotificationCategory } from '@world-schools/wc-types'
import { PrismaService } from '../../../prisma/prisma.service'
import { RedisService } from '../../redis/redis.service'
import { listCatalogEntries } from '../catalog/notification-catalog'
import type { CatalogEntry } from '../catalog/types'
import type { NotificationChannel } from '../queue/queue.types'

/** Cache key for `deriveAudience`. 5-minute TTL — short enough that a role
 *  flip propagates in under 5 minutes, long enough to absorb the bursts
 *  that come from a notifications-page poll loop. */
const AUDIENCE_CACHE_PREFIX = 'notif:audience:'
const AUDIENCE_CACHE_TTL_SECONDS = 5 * 60
/** Sentinel value persisted when `deriveAudience` returns null so the cache
 *  distinguishes "no audience" from "miss". */
const NULL_AUDIENCE_SENTINEL = '__none__'

export type Audience = 'parent' | 'provider' | 'superadmin'

/**
 * Per-template-key + channel preference row returned by `listForUser`.
 * Transactional rows render locked in the UI with `enabled: true`.
 */
export interface PreferenceRow {
  templateKey: string
  channel: NotificationChannel
  enabled: boolean
  transactional: boolean
  category: NotificationCategory
  label: string
  description: string
}

export interface BulkSetItem {
  templateKey: string
  channel: NotificationChannel
  enabled: boolean
}

/**
 * Per-user preference filter applied at dispatch time for non-transactional
 * notifications. Defaults to enabled when no row exists, so the model only
 * holds opt-OUT state — keeps the table small (no row per user × template
 * combo until the user explicitly toggles).
 *
 * Transactional categories (booking lifecycle, payments, refunds, disputes,
 * security) bypass this entirely via `entry.transactional === true` on the
 * dispatcher side — that check happens BEFORE this service is consulted.
 */
@Injectable()
export class NotificationPreferencesService {
  private readonly logger = new Logger(NotificationPreferencesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  /**
   * Detects which catalog audience the user belongs to. Priority:
   *  1. Parent (Parent row exists) — every Parent is a parent, period.
   *  2. Superadmin (system-role membership, not 'Parent').
   *  3. Provider (any provider-scoped role).
   *
   * Returns `null` for users with none of the above (rare — e.g. a stale
   * account row); the controller treats null as "no preferences UI".
   *
   * Phase 14d — Redis-cached for 5 minutes. The preferences page polls on
   * every render, and `deriveAudience` is the hot path: two indexed Prisma
   * queries per request. Cache miss → DB hits → cache write; cache hit →
   * single Redis GET. Soft-fails to "compute fresh" if Redis is unreachable
   * so a flaky cache never breaks the settings page.
   */
  async deriveAudience(userId: string): Promise<Audience | null> {
    const cacheKey = `${AUDIENCE_CACHE_PREFIX}${userId}`

    // Cache lookup — soft-fail to fresh compute on any Redis hiccup.
    if (this.redis.isReady()) {
      try {
        const cached = await this.redis.get(cacheKey)
        if (cached === NULL_AUDIENCE_SENTINEL) return null
        if (cached === 'parent' || cached === 'provider' || cached === 'superadmin') {
          return cached
        }
      } catch (err) {
        this.logger.warn(
          `deriveAudience cache read failed for ${userId}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    const audience = await this.computeAudience(userId)

    if (this.redis.isReady()) {
      try {
        await this.redis.set(
          cacheKey,
          audience ?? NULL_AUDIENCE_SENTINEL,
          AUDIENCE_CACHE_TTL_SECONDS
        )
      } catch (err) {
        this.logger.warn(
          `deriveAudience cache write failed for ${userId}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    return audience
  }

  /** Cache invalidation hook for callers that mutate Parent / UserRole rows.
   *  Currently unused (audience changes propagate within 5min naturally);
   *  exposed so the auth / role-mutation paths can wire it later. */
  async invalidateAudienceCache(userId: string): Promise<void> {
    if (!this.redis.isReady()) return
    try {
      await this.redis.del(`${AUDIENCE_CACHE_PREFIX}${userId}`)
    } catch (err) {
      this.logger.warn(
        `deriveAudience cache invalidate failed for ${userId}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  private async computeAudience(userId: string): Promise<Audience | null> {
    const [parent, userRoles] = await Promise.all([
      this.prisma.parent.findUnique({ where: { userId }, select: { id: true } }),
      this.prisma.userRole.findMany({
        where: { userId },
        select: { role: { select: { name: true, providerId: true } } },
      }),
    ])
    if (parent) return 'parent'
    const isSuperadmin = userRoles.some(r => r.role.providerId == null && r.role.name !== 'Parent')
    if (isSuperadmin) return 'superadmin'
    const isProvider = userRoles.some(r => r.role.providerId != null)
    if (isProvider) return 'provider'
    return null
  }

  /**
   * Phase 12 — returns the full preference list for the user's audience,
   * merged with any opt-out rows. Transactional entries are returned with
   * `enabled: true, transactional: true` so the UI can render them locked.
   *
   * Entries are flattened: one row per (templateKey × channel). The UI
   * groups by category to render the sectioned settings page.
   */
  async listForUser(userId: string): Promise<PreferenceRow[]> {
    const audience = await this.deriveAudience(userId)
    if (!audience) return []

    const entries = listCatalogEntries().filter(e => e.audience === audience)
    const optOuts = await this.prisma.notificationPreference.findMany({
      where: { userId, templateKey: { in: entries.map(e => e.templateKey) }, enabled: false },
      select: { templateKey: true, channel: true },
    })
    const disabled = new Set(optOuts.map(o => `${o.templateKey}::${o.channel}`))

    const rows: PreferenceRow[] = []
    for (const entry of entries) {
      const meta = deriveLabel(entry)
      for (const channel of entry.channels) {
        const key = `${entry.templateKey}::${channel}`
        rows.push({
          templateKey: entry.templateKey,
          channel: channel as NotificationChannel,
          enabled: entry.transactional ? true : !disabled.has(key),
          transactional: entry.transactional,
          category: entry.category,
          label: meta.label,
          description: meta.description,
        })
      }
    }
    return rows
  }

  /**
   * Phase 12 — bulk-upsert preferences. Validates each item's templateKey
   * belongs to the user's audience (silent skip otherwise). Single
   * transaction so the whole save either lands or nothing does.
   */
  async bulkSetPreferences(userId: string, items: BulkSetItem[]): Promise<number> {
    const audience = await this.deriveAudience(userId)
    if (!audience) return 0
    const allowed = new Set(
      listCatalogEntries()
        .filter(e => e.audience === audience && !e.transactional)
        .map(e => e.templateKey)
    )
    const filtered = items.filter(i => allowed.has(i.templateKey))
    if (filtered.length === 0) return 0

    await this.prisma.$transaction(
      filtered.map(item =>
        this.prisma.notificationPreference.upsert({
          where: {
            userId_templateKey_channel: {
              userId,
              templateKey: item.templateKey,
              channel: item.channel,
            },
          },
          create: {
            userId,
            templateKey: item.templateKey,
            channel: item.channel,
            enabled: item.enabled,
          },
          update: { enabled: item.enabled },
        })
      )
    )
    return filtered.length
  }

  /**
   * Returns the subset of `channels` the user has opted-in to (or that
   * have no explicit opt-out row). Used by the dispatcher to skip
   * enqueueing channels the user disabled — saves both queue churn AND
   * a useless `skipped` row in NotificationDelivery.
   */
  async filterChannels(
    userId: string,
    templateKey: string,
    channels: NotificationChannel[]
  ): Promise<NotificationChannel[]> {
    try {
      const rows = await this.prisma.notificationPreference.findMany({
        where: { userId, templateKey, channel: { in: channels } },
        select: { channel: true, enabled: true },
      })
      const disabled = new Set(
        rows.filter(r => !r.enabled).map(r => r.channel as NotificationChannel)
      )
      return channels.filter(c => !disabled.has(c))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `filterChannels(${userId}, ${templateKey}) failed: ${message} — defaulting to all channels enabled`
      )
      return channels
    }
  }

  /**
   * Upsert a single preference. Used by the preferences UI's PATCH endpoint
   * (Phase 12). Idempotent.
   */
  async setPreference(
    userId: string,
    templateKey: string,
    channel: NotificationChannel,
    enabled: boolean
  ): Promise<void> {
    await this.prisma.notificationPreference.upsert({
      where: { userId_templateKey_channel: { userId, templateKey, channel } },
      create: { userId, templateKey, channel, enabled },
      update: { enabled },
    })
  }
}

/**
 * Derive a user-friendly label + description from a catalog entry. The
 * catalog stores per-channel `title`/`subject` functions that take the
 * loaded props at fire time — for the settings UI we need a static
 * description, so we derive from the templateKey's dotted segments.
 */
function deriveLabel(entry: CatalogEntry<unknown>): { label: string; description: string } {
  const segments = entry.templateKey.split('.')
  const leaf = segments[segments.length - 1] ?? entry.templateKey
  // Humanise: "balanceReminder14d" → "Balance reminder 14d"
  const label = leaf
    .replace(/([A-Z])/g, ' $1')
    .replace(/(\d+)/g, ' $1')
    .replace(/^./, c => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim()
  const description = entry.transactional
    ? `Always sent — required for ${entry.category} updates.`
    : `Optional updates in the ${entry.category} category.`
  return { label, description }
}
