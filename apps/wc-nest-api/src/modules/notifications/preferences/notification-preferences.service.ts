import { Injectable, Logger } from '@nestjs/common'
import type { NotificationCategory } from '@world-schools/wc-types'
import { PrismaService } from '../../../prisma/prisma.service'
import { listCatalogEntries } from '../catalog/notification-catalog'
import type { CatalogEntry } from '../catalog/types'
import type { NotificationChannel } from '../queue/queue.types'
import { NOTIFICATION_SETTINGS_COPY } from './notification-settings-copy'

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

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the full preference list for the given audience, merged
   * with any opt-out rows. Transactional entries are returned with
   * `enabled: true, transactional: true` so the UI can render them locked.
   *
   * The `audience` is supplied by the caller (the app-prefixed controller —
   * `/user` → parent, `/provider` → provider, `/superadmin` → superadmin),
   * which the JWT strategy already enforces via the `payload.app` claim. There
   * is no role-based re-derivation here.
   *
   * Entries are flattened: one row per (templateKey × channel). The UI
   * groups by category to render the sectioned settings page.
   */
  async listForUser(userId: string, audience: Audience): Promise<PreferenceRow[]> {
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
   * Bulk-upsert preferences. Validates each item's templateKey
   * belongs to the given audience (silent skip otherwise). Single transaction
   * so the whole save either lands or nothing does. `audience` comes from the
   * app-prefixed controller (see `listForUser`).
   */
  async bulkSetPreferences(
    userId: string,
    audience: Audience,
    items: BulkSetItem[]
  ): Promise<number> {
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
   * Upsert a single preference. Used by the preferences UI's PATCH endpoint.
   * Idempotent.
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
 * Resolve a user-friendly label + description for a catalog entry. Prefers the
 * curated `NOTIFICATION_SETTINGS_COPY` map (single source of truth, drift-
 * guarded by `notification-settings-copy.spec.ts`); falls back to a humanised
 * heuristic for any not-yet-curated key so a new notification still renders.
 */
function deriveLabel(entry: CatalogEntry<unknown>): { label: string; description: string } {
  const curated = NOTIFICATION_SETTINGS_COPY[entry.templateKey]
  if (curated) return curated

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
