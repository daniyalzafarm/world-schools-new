import { BookingGroupStatus } from '../../../generated/client/enums'

/**
 * Statuses in which a booking's provider has ALREADY ACCEPTED and the booking is
 * live, so a scheduled capture (deposit or balance) is allowed to fire.
 *
 * This is the single source of truth for the acceptance guard's status check —
 * the contractual invariant that NO capture fires before the provider accepts
 * (CT v1.4 §5.2(f), §7.4(d)). It is shared by:
 *   - the scheduled-capture reconciliation cron eligibility query,
 *   - the off-session balance pickup query (`balance-charge.cron.ts`),
 *   - the `capture-engine` per-row status guard,
 * so they can never drift.
 *
 * Deliberately EXCLUDES `payment_authorized` (auth placed at request, BEFORE
 * acceptance) and all terminal-negative states (declined / expired / cancelled /
 * refunded / payment_failed / payment_review / disputed). The acceptance guard
 * also requires `acceptanceTime IS NOT NULL` as a second, independent check.
 */
export const CAPTURE_ELIGIBLE_STATUSES: BookingGroupStatus[] = [
  BookingGroupStatus.accepted,
  BookingGroupStatus.provider_accepted,
  BookingGroupStatus.waiting_for_grace_deadline,
  BookingGroupStatus.deposit_captured,
  BookingGroupStatus.deposit_paid,
  BookingGroupStatus.fully_paid,
  BookingGroupStatus.at_camp,
]
