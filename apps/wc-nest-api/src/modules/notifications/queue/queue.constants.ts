/**
 * BullMQ queue + job names for the notifications subsystem.
 *
 * Two queues split the live and scheduled work so retries/delays on the
 * scheduled queue don't compete with the live queue's concurrency budget,
 * and so ops can pause one without the other.
 */
export const QUEUE_NAMES = {
  /** Live notifications (delay = 0). Worker concurrency tuned for throughput. */
  Notifications: 'notifications',
  /** Future-dated notifications (reminders, pre-camp nudges, etc.). */
  NotificationsScheduled: 'notifications.scheduled',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

/**
 * Job name shared by both queues. The worker dispatches by the `channels`
 * field of the job payload rather than by job name so the payload type
 * stays single.
 */
export const JOB_NAMES = {
  DispatchNotification: 'dispatch',
} as const
