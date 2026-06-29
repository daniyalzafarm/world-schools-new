import type { ComponentType } from 'react'
import type {
  NotificationCategory,
  NotificationEntityType,
  NotificationType,
} from '@world-schools/wc-types'
import type { PrismaService } from '../../../prisma/prisma.service'
import type { NotificationChannel, NotificationContext } from '../queue/queue.types'
import type { ResolverKey } from '../resolvers/recipient-resolvers'

export type Audience = 'parent' | 'provider' | 'superadmin'

/**
 * Salutation style per spec `Notes & Conventions`:
 *  - `'hi'`   — parent standard ("Hi {firstName},", fallback "Hi there,")
 *  - `'dear'` — parent formal: financial distress, disputes
 *  - `'none'` — provider / superadmin (no salutation per B2B convention)
 */
export type SalutationStyle = 'hi' | 'dear' | 'none'

export type PropLoader<TProps> = (
  prisma: PrismaService,
  ctx: NotificationContext
) => Promise<TProps>

/**
 * Single source of truth for a notification trigger. The dispatcher, worker,
 * and QA tooling all read entries from this shape. Keeping in_app and email
 * rendering colocated with the recipient resolver, prop loader, and
 * preference flags eliminates the "spot the missing channel" failure mode
 * that the ad-hoc handler approach had.
 *
 * Per-entry `<TProps>` keeps the email component, the in-app string builders,
 * and the prop loader inferentially aligned — TypeScript guarantees the
 * worker hands the correct shape to each.
 */
export interface CatalogEntry<TProps = unknown> {
  /** Enum value from `wc-types/NotificationType`. */
  type: NotificationType
  /** Stable, human-readable id (e.g. `parent.booking.accepted`). Used as
   *  the BullMQ jobId prefix, the `NotificationDelivery.template_key`, the
   *  dedupe-key prefix, and the QA matrix row label. Must equal
   *  `type`'s string value by convention so logs cross-reference cleanly. */
  templateKey: string
  audience: Audience
  category: NotificationCategory
  channels: NotificationChannel[]
  salutation: SalutationStyle

  /** Catalog → resolver registry pointer. Lets the QA generator print
   *  resolver names and lets a lint pass detect unreferenced resolvers. */
  resolver: ResolverKey

  /** Bypasses user preference filtering. Set true for booking lifecycle,
   *  payments, refunds, disputes, security — anything the user must always
   *  receive. False for marketing / wishlist / promotional reminders. */
  transactional: boolean

  /** `'live'` fires on emit (delay = 0). `'scheduled'` fires via a future
   *  `runAt` carried alongside the dispatch event. Reconciliation cron
   *  uses this flag to know which entries to sweep. */
  trigger: 'live' | 'scheduled'

  /** Hydrates the catalog context into typed props for the templates. The
   *  worker calls this after dequeueing so retries days later read fresh
   *  DB state. */
  loadProps: PropLoader<TProps>

  /** Optional dedupe-key builder. Defaults to
   *  `${type}:${recipientUserId}:${entityId | 'global'}`. Override when
   *  finer or coarser granularity is needed (e.g. one-per-day cap). */
  dedupeKey?: (recipientUserId: string, ctx: NotificationContext) => string

  email?: {
    component: ComponentType<TProps>
    subject: (props: TProps) => string
    /** When true the worker also renders a plain-text alternative via
     *  `@react-email/render { plainText: true }`. */
    includePlainText: boolean
  }

  inApp?: {
    title: (props: TProps) => string
    body: (props: TProps) => string
    entityType?: NotificationEntityType
    entityId: (props: TProps) => string
    /** Deep-link target for the click-through on the notifications page.
     *  Receives the job's `NotificationContext` as a second arg so builders
     *  can link by the entity's UUID (`ctx.bookingGroupId`, `ctx.supportTicketId`,
     *  …) instead of the human-readable number in `props` — the app routes
     *  resolve by UUID. Builders that link to a static path can ignore it. */
    redirectUrl: (props: TProps, ctx: NotificationContext) => string
    /** Extra metadata merged into `Notification.metadata` alongside
     *  `{ redirectUrl }`. Use for display fields the frontend needs but the
     *  redirect URL alone doesn't convey — e.g. `bookingGroupNumber`,
     *  `campName`, `senderName`, `messagePreview`. The legacy
     *  `BookingWebSocketHandler` populated `bookingGroupNumber` + `campName`
     *  this way; opting back in here keeps frontends working. */
    metadata?: (props: TProps) => Record<string, unknown>
  }
}
