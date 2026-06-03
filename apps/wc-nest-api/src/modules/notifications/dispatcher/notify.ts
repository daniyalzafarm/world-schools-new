import { Logger } from '@nestjs/common'
import type { EventEmitter2 } from '@nestjs/event-emitter'
import type { NotificationType } from '@world-schools/wc-types'
import type { NotificationContext } from '../queue/queue.types'

/** Internal EventEmitter2 event name the dispatcher listens on. */
export const NOTIFICATION_DISPATCH_EVENT = 'notification.dispatch'

const logger = new Logger('notify')

export interface NotificationDispatchEvent {
  type: NotificationType
  context: NotificationContext
  /** Future fire time for scheduled triggers. Absent → fire immediately. */
  runAt?: Date
}

/**
 * Single entry point domain services use to request a notification.
 *
 * Domain commits its DB state FIRST, then calls `notify(...)`. The
 * dispatcher picks it up off the event bus, looks up the catalog entry,
 * resolves recipients, applies preferences, and enqueues BullMQ jobs.
 * Domain services never touch the queue, never touch templates, never
 * touch recipient lookup — all that lives behind the catalog.
 *
 * **Phase 14c hardening — never throws to the caller.** EventEmitter2's
 * `emit` is synchronous and only throws if a listener throws synchronously
 * (the dispatcher's `@OnEvent({ async: true })` decorator runs it on the
 * micro-task queue, so today it can't). But ~50 domain call sites
 * (`BookingGroupsService.acceptForProvider`, `RefundsService.markGroupCancelled`,
 * etc.) call `notify()` immediately after a DB commit; if the notification
 * pipeline ever started to throw, a booking would fail because email
 * dispatch hiccupped. Wrapping at the helper level enforces "notifications
 * are best-effort" as an invariant — no caller needs the try/catch.
 */
export function notify(
  events: EventEmitter2,
  type: NotificationType,
  context: NotificationContext,
  runAt?: Date
): void {
  const event: NotificationDispatchEvent = { type, context, runAt }
  try {
    events.emit(NOTIFICATION_DISPATCH_EVENT, event)
  } catch (err) {
    logger.error(
      `notify(${type}) emit failed — domain operation continues: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
