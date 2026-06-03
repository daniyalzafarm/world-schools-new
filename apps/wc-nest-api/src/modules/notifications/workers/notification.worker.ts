import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { EmailService } from '@world-schools/global-utils'
import { renderEmail } from '@world-schools/wc-email-templates'
import type { NotificationEntityType } from '@world-schools/wc-types'
import { PrismaService } from '../../../prisma/prisma.service'
import { getCatalogEntry } from '../catalog/notification-catalog'
import { NotificationsService } from '../notifications.service'
import { NotificationsMetricsService } from '../observability/notifications-metrics.service'
import { QUEUE_NAMES } from '../queue/queue.constants'
import type {
  NotificationChannel,
  NotificationContext,
  NotificationJobData,
} from '../queue/queue.types'
import type { CatalogEntry, SalutationStyle } from '../catalog/types'

/**
 * Live + scheduled queue worker. Single processor handles both queues —
 * email and in-app share `loadProps` and recipient lookup, so splitting
 * per channel would double DB work for `channels: ['in_app','email']`
 * triggers (which is most of them).
 *
 * Each job represents (catalog type × one recipient × resolved channels).
 * The worker:
 *  1. Reloads catalog entry (no embedded entity in payload).
 *  2. Dedupe-checks NotificationDelivery — if a `sent` row already exists
 *     for this (templateKey, channel, dedupeKey), marks the job complete.
 *  3. Calls `entry.loadProps(prisma, ctx)` — fresh DB read so scheduled
 *     reminders reflect current state (refund amounts, dates, etc.).
 *  4. Dispatches to in_app and/or email per channel.
 *  5. Upserts NotificationDelivery rows so the unique index does the
 *     idempotency work going forward.
 */
@Processor(QUEUE_NAMES.Notifications)
export class NotificationLiveWorker extends WorkerHost {
  protected readonly logger = new Logger(NotificationLiveWorker.name)

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly notificationsService: NotificationsService,
    protected readonly emailService: EmailService,
    protected readonly metrics: NotificationsMetricsService
  ) {
    super()
  }

  override async process(job: Job<NotificationJobData>): Promise<void> {
    await runNotificationJob(job, {
      prisma: this.prisma,
      notificationsService: this.notificationsService,
      emailService: this.emailService,
      metrics: this.metrics,
      logger: this.logger,
    })
  }
}

@Processor(QUEUE_NAMES.NotificationsScheduled)
export class NotificationScheduledWorker extends WorkerHost {
  protected readonly logger = new Logger(NotificationScheduledWorker.name)

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly notificationsService: NotificationsService,
    protected readonly emailService: EmailService,
    protected readonly metrics: NotificationsMetricsService
  ) {
    super()
  }

  override async process(job: Job<NotificationJobData>): Promise<void> {
    await runNotificationJob(job, {
      prisma: this.prisma,
      notificationsService: this.notificationsService,
      emailService: this.emailService,
      metrics: this.metrics,
      logger: this.logger,
    })
  }
}

interface RunDeps {
  prisma: PrismaService
  notificationsService: NotificationsService
  emailService: EmailService
  metrics: NotificationsMetricsService
  logger: Logger
}

/**
 * Compact structured-context prefix for log lines. Keeps templateKey,
 * recipientUserId, jobId, dedupeKey grep-able by log aggregators without
 * pulling in a separate logger library. Example output:
 *   [ctx tpl=parent.booking.accepted user=u-1 job=42 chan=email] ...
 */
function fmt(ctx: Record<string, string | number | undefined | null>): string {
  const parts = Object.entries(ctx)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
  return `[ctx ${parts}]`
}

/**
 * Strip stack traces / multi-line provider messages before persisting an
 * error to the `NotificationDelivery.errorMessage` text column. The column
 * is visible in Bull Board and to anyone with DB read; a raw `error.message`
 * with embedded credentials (e.g. an SMTP failure echoing the auth header)
 * is a leak. Single-line cap at 500 chars matches the failure-listener.
 */
function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw.split('\n')[0]?.slice(0, 500) ?? ''
}

/**
 * Shared job runner. Extracted so the live + scheduled workers don't drift.
 *
 * Worker concurrency is left at BullMQ's default (1) for v1 — Phase 7+
 * can tune via `worker.concurrency = N` on a per-queue basis once we have
 * volume data.
 */
async function runNotificationJob(job: Job<NotificationJobData>, deps: RunDeps): Promise<void> {
  const { type, recipientUserId, channels, context, dedupeKey } = job.data
  const baseCtx = {
    tpl: type,
    user: recipientUserId,
    job: job.id ?? undefined,
    dedupe: dedupeKey,
  }
  const entry = getCatalogEntry(type)
  if (!entry) {
    deps.logger.error(`${fmt(baseCtx)} catalog entry missing — failing job permanently`)
    throw new Error(`No catalog entry for ${type}`)
  }

  // Resolve recipient email once for the email channel.
  const recipient = channels.includes('email')
    ? await deps.prisma.user.findUnique({
        where: { id: recipientUserId },
        select: { email: true, firstName: true },
      })
    : null

  // Wrap loadProps so a Prisma transient / loader bug writes a `failed`
  // delivery row for every channel (instead of throwing past the audit
  // loop with no DB record). The re-throw still gives BullMQ its retry
  // signal; the failed-event listener promotes to terminal on exhaustion.
  let props: unknown
  try {
    props = await entry.loadProps(deps.prisma, context)
  } catch (err) {
    const message = sanitizeErrorMessage(err)
    deps.logger.error(
      `${fmt({ ...baseCtx, attempt: job.attemptsMade + 1 })} loadProps threw: ${message}`
    )
    for (const channel of channels) {
      await upsertDelivery(deps.prisma, {
        entry,
        type,
        recipientUserId,
        channel,
        dedupeKey,
        jobId: job.id,
        status: 'failed',
        errorMessage: `loadProps: ${message}`,
        attempt: job.attemptsMade + 1,
      })
      deps.metrics.recordFailed(channel)
    }
    throw err
  }

  // Entity binding for the audit log. `entityType` is static per catalog
  // entry (lives on inApp). `entityId` is derived from props when available;
  // for skipped/failed paths where props is null, fall back to undefined
  // (the row is still useful for ops triage even without an entity link).
  const entityType = entry.inApp?.entityType
  const entityId =
    props != null && entry.inApp?.entityId ? entry.inApp.entityId(props) || undefined : undefined

  for (const channel of channels) {
    const chanCtx = { ...baseCtx, chan: channel }
    const existing = await deps.prisma.notificationDelivery.findUnique({
      where: {
        templateKey_channel_dedupeKey: {
          templateKey: entry.templateKey,
          channel,
          dedupeKey,
        },
      },
      select: { id: true, status: true },
    })
    if (existing?.status === 'sent') {
      deps.logger.debug(`${fmt(chanCtx)} dedupe hit — skipping`)
      continue
    }

    if (props == null) {
      // loadProps signaled "no longer relevant" — mark skipped and move on.
      await upsertDelivery(deps.prisma, {
        entry,
        type,
        recipientUserId,
        channel,
        dedupeKey,
        jobId: job.id,
        status: 'skipped',
        errorMessage: 'loadProps returned null',
        entityType,
        entityId,
      })
      deps.metrics.recordSkipped(channel)
      continue
    }

    try {
      if (channel === 'in_app') {
        await dispatchInApp(deps.notificationsService, entry, recipientUserId, props, context)
      } else if (channel === 'email') {
        if (!recipient?.email) {
          deps.logger.warn(`${fmt(chanCtx)} no email on recipient — skipping`)
          await upsertDelivery(deps.prisma, {
            entry,
            type,
            recipientUserId,
            channel,
            dedupeKey,
            jobId: job.id,
            status: 'skipped',
            errorMessage: 'recipient has no email address',
            entityType,
            entityId,
          })
          deps.metrics.recordSkipped(channel)
          continue
        }
        await dispatchEmail(
          deps.emailService,
          entry,
          { email: recipient.email, firstName: recipient.firstName },
          props,
          dedupeKey
        )
      }
      await upsertDelivery(deps.prisma, {
        entry,
        type,
        recipientUserId,
        channel,
        dedupeKey,
        jobId: job.id,
        status: 'sent',
        entityType,
        entityId,
      })
      deps.metrics.recordSent(channel)
    } catch (error) {
      const message = sanitizeErrorMessage(error)
      deps.logger.error(`${fmt({ ...chanCtx, attempt: job.attemptsMade + 1 })} ${message}`)
      await upsertDelivery(deps.prisma, {
        entry,
        type,
        recipientUserId,
        channel,
        dedupeKey,
        jobId: job.id,
        status: 'failed',
        errorMessage: message,
        attempt: job.attemptsMade + 1,
        entityType,
        entityId,
      })
      deps.metrics.recordFailed(channel)
      throw error // let BullMQ retry per the queue's backoff policy
    }
  }
}

async function dispatchInApp(
  notificationsService: NotificationsService,
  entry: CatalogEntry<unknown>,
  userId: string,
  props: unknown,
  context: NotificationContext
): Promise<void> {
  if (!entry.inApp) return
  const inApp = entry.inApp as CatalogEntry<unknown>['inApp']
  if (!inApp) return
  // Merge any per-entry metadata builder OUTPUT into the always-present
  // `redirectUrl`. The redirect URL wins if a builder accidentally
  // collides on the key — it's the load-bearing field for click-through.
  // `context` is passed so builders can deep-link by entity UUID.
  const extra = inApp.metadata?.(props) ?? {}
  await notificationsService.create({
    userId,
    type: entry.type,
    title: inApp.title(props),
    body: inApp.body(props),
    entityType: inApp.entityType as NotificationEntityType | undefined,
    entityId: inApp.entityId(props) || undefined,
    metadata: { ...extra, redirectUrl: inApp.redirectUrl(props, context) },
  })
}

async function dispatchEmail(
  emailService: EmailService,
  entry: CatalogEntry<unknown>,
  recipient: { email: string; firstName: string | null },
  props: unknown,
  dedupeKey: string
): Promise<void> {
  if (!entry.email) return
  const email = entry.email as CatalogEntry<unknown>['email']
  if (!email) return

  // Apply per-entry salutation override if the template accepts one.
  // The convention is `props.salutation` and `props.firstName`; templates
  // that don't accept these still receive the passthrough cleanly.
  const propsWithRecipient = {
    ...(props as Record<string, unknown>),
    salutation: ((props as Record<string, unknown>).salutation ??
      entry.salutation) as SalutationStyle,
    firstName: (props as Record<string, unknown>).firstName ?? recipient.firstName,
  }

  const { html, text } = await renderEmail(email.component, propsWithRecipient, {
    includePlainText: email.includePlainText,
  })

  await emailService.sendEmail({
    to: recipient.email,
    subject: email.subject(propsWithRecipient as unknown),
    html,
    text: text || undefined,
    messageId: `${dedupeKey}@worldcamps`,
  })
}

interface UpsertDeliveryArgs {
  entry: CatalogEntry<unknown>
  type: string
  recipientUserId: string
  channel: NotificationChannel
  dedupeKey: string
  jobId?: string | null
  status: 'sent' | 'failed' | 'skipped'
  errorMessage?: string
  attempt?: number
  /** Mirrored on the audit row for support tooling. Static per catalog entry
   *  (from `entry.inApp.entityType`); resolved from props by the caller. */
  entityType?: NotificationEntityType
  entityId?: string
}

async function upsertDelivery(prisma: PrismaService, args: UpsertDeliveryArgs): Promise<void> {
  await prisma.notificationDelivery.upsert({
    where: {
      templateKey_channel_dedupeKey: {
        templateKey: args.entry.templateKey,
        channel: args.channel,
        dedupeKey: args.dedupeKey,
      },
    },
    create: {
      templateKey: args.entry.templateKey,
      type: args.type,
      recipientUserId: args.recipientUserId,
      channel: args.channel,
      dedupeKey: args.dedupeKey,
      status: args.status,
      attempt: args.attempt ?? 1,
      jobId: args.jobId ?? null,
      errorMessage: args.errorMessage,
      entityType: args.entityType ?? null,
      entityId: args.entityId ?? null,
      sentAt: args.status === 'sent' ? new Date() : null,
    },
    update: {
      status: args.status,
      attempt: args.attempt ?? undefined,
      jobId: args.jobId ?? undefined,
      errorMessage: args.errorMessage ?? null,
      // Only set entity fields when present — preserve any prior population
      // on retry. (First attempt usually has them; later retries may not.)
      entityType: args.entityType ?? undefined,
      entityId: args.entityId ?? undefined,
      sentAt: args.status === 'sent' ? new Date() : undefined,
    },
  })
}
