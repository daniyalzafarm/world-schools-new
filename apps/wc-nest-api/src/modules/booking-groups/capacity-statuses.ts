import { BookingGroupStatus } from '../../generated/client/enums'

/**
 * Statuses that count toward a session's used capacity (a child holding a spot).
 * Drafts and terminal-negative statuses (declined/expired/cancelled/refunded) do
 * NOT consume a spot.
 *
 * Single source of truth shared by the submit-time capacity guard, the
 * duplicate-booking guard, the eligibility overlap check, and the parent's
 * existing-booking-ranges lookup — keep it in one place so they never drift.
 */
export const CAPACITY_CONSUMING_STATUSES: BookingGroupStatus[] = [
  BookingGroupStatus.request,
  BookingGroupStatus.accepted,
  BookingGroupStatus.deposit_paid,
  BookingGroupStatus.fully_paid,
  BookingGroupStatus.at_camp,
  BookingGroupStatus.completed,
]
