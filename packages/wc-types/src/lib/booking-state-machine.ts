import type { BookingGroupStatus } from './bookings.types'

/**
 * Authoritative booking-group lifecycle graph.
 *
 * Single source of truth for which `BookingGroupStatus` transitions are legal,
 * shared by the API (to guard every status write) and the frontends (to decide
 * which actions to surface). Mirrors the lifecycle documented on the Prisma
 * `Booking` / `BookingGroupStatus` models:
 *
 *   draft → request → accepted|declined|expired
 *   accepted → deposit_paid|fully_paid|… ; any active → cancelled|disputed
 *   deposit_paid → fully_paid|payment_failed
 *   fully_paid → at_camp → completed
 *   refunds: → partially_refunded|fully_refunded
 *
 * The map is intentionally a faithful SUPERSET of every real transition
 * (booking flow + billing module) so that routing a write through
 * `assertValidTransition` never blocks a legitimate billing state change.
 * A same-state write is always allowed (idempotent retries / no-op updates).
 */
export const BOOKING_STATE_TRANSITIONS: Record<BookingGroupStatus, readonly BookingGroupStatus[]> =
  {
    draft: ['request', 'cancelled'],
    request: ['accepted', 'declined', 'expired', 'cancelled'],
    accepted: ['deposit_paid', 'fully_paid', 'cancelled', 'disputed', 'payment_failed'],
    deposit_paid: [
      'fully_paid',
      'payment_failed',
      'cancelled',
      'disputed',
      'partially_refunded',
      'fully_refunded',
      'at_camp',
    ],
    fully_paid: [
      'at_camp',
      'completed',
      'cancelled',
      'disputed',
      'partially_refunded',
      'fully_refunded',
    ],
    at_camp: ['completed', 'disputed', 'partially_refunded', 'fully_refunded', 'cancelled'],
    completed: ['disputed', 'partially_refunded', 'fully_refunded'],
    payment_failed: ['fully_paid', 'deposit_paid', 'cancelled'],
    disputed: [
      'accepted',
      'deposit_paid',
      'fully_paid',
      'completed',
      'partially_refunded',
      'fully_refunded',
      'cancelled',
    ],
    partially_refunded: ['fully_refunded', 'cancelled', 'disputed'],
    // Terminal states — no outbound transitions.
    declined: [],
    expired: [],
    cancelled: [],
    fully_refunded: [],
  }

/** Statuses from which no further transition is allowed. */
export const TERMINAL_BOOKING_STATUSES: readonly BookingGroupStatus[] = [
  'declined',
  'expired',
  'cancelled',
  'fully_refunded',
]

/**
 * True when `to` is a legal next state from `from`. A same-state write is
 * always legal (covers idempotent retries / no-op updates).
 */
export function isValidTransition(from: BookingGroupStatus, to: BookingGroupStatus): boolean {
  if (from === to) return true
  return (BOOKING_STATE_TRANSITIONS[from] ?? []).includes(to)
}

/** The set of legal next states from `from` (excluding the same-state no-op). */
export function getNextValidStates(from: BookingGroupStatus): readonly BookingGroupStatus[] {
  return BOOKING_STATE_TRANSITIONS[from] ?? []
}

export function isTerminalStatus(status: BookingGroupStatus): boolean {
  return TERMINAL_BOOKING_STATUSES.includes(status)
}

/**
 * Thrown by `assertValidTransition`. Kept as a plain Error subclass (no NestJS
 * dependency) so it is importable in the frontends; the API maps it to a 409.
 */
export class InvalidBookingTransitionError extends Error {
  constructor(
    public readonly from: BookingGroupStatus,
    public readonly to: BookingGroupStatus
  ) {
    super(`Invalid booking status transition: ${from} → ${to}`)
    this.name = 'InvalidBookingTransitionError'
  }
}

/** Throws `InvalidBookingTransitionError` when the transition is illegal. */
export function assertValidTransition(from: BookingGroupStatus, to: BookingGroupStatus): void {
  if (!isValidTransition(from, to)) {
    throw new InvalidBookingTransitionError(from, to)
  }
}
