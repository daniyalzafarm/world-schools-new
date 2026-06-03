import { NotificationCategory } from '@world-schools/wc-types'
import type { NotificationFilterConfig } from './use-notifications-page'

/**
 * Audience-specific filter sets for the notifications page (Phase 14d).
 *
 * Replaces the per-app inline definitions in `wc-booking`, `wc-provider`,
 * and `wc-superadmin` so a new category never has to be added in three
 * places. Returned arrays are module-level constants — re-using the same
 * reference across renders also satisfies the audit's "filter chips not
 * memoized" finding (#14) because `useNotificationsPage`'s `useMemo` keys
 * on referential equality.
 *
 * Add a new audience here when one ships (e.g. partner / scout). Update
 * an existing audience's filters by editing the relevant `*_FILTERS`
 * constant — every app picks up the change automatically.
 */
export type NotificationAudience = 'parent' | 'provider' | 'superadmin'

/** Parent — 51 catalog entries grouped across 7 tabs. */
export const PARENT_FILTERS: ReadonlyArray<NotificationFilterConfig> = [
  { value: 'all', label: 'All', special: 'all' },
  { value: 'unread', label: 'Unread', special: 'unread', showUnreadCount: true },
  {
    value: 'bookings',
    label: 'Bookings',
    categories: [NotificationCategory.Booking],
  },
  {
    value: 'payments',
    label: 'Payments',
    categories: [
      NotificationCategory.Payment,
      NotificationCategory.Refund,
      NotificationCategory.Dispute,
    ],
  },
  {
    value: 'messages',
    label: 'Messages',
    categories: [NotificationCategory.Message, NotificationCategory.Support],
  },
  { value: 'reviews', label: 'Reviews', categories: [NotificationCategory.Review] },
  { value: 'offers', label: 'Offers', categories: [NotificationCategory.Wishlist] },
]

/** Provider — 53 catalog entries grouped across 7 tabs. */
export const PROVIDER_FILTERS: ReadonlyArray<NotificationFilterConfig> = [
  { value: 'all', label: 'All', special: 'all' },
  { value: 'unread', label: 'Unread', special: 'unread', showUnreadCount: true },
  {
    value: 'bookings',
    label: 'Bookings',
    categories: [NotificationCategory.Booking],
  },
  {
    value: 'payouts',
    label: 'Payouts',
    categories: [
      NotificationCategory.Payment,
      NotificationCategory.Payout,
      NotificationCategory.Refund,
      NotificationCategory.Dispute,
    ],
  },
  {
    value: 'messages',
    label: 'Messages',
    categories: [NotificationCategory.Message, NotificationCategory.Support],
  },
  { value: 'reviews', label: 'Reviews', categories: [NotificationCategory.Review] },
  {
    value: 'onboarding',
    label: 'Onboarding',
    categories: [NotificationCategory.Onboarding, NotificationCategory.Profile],
  },
]

/** Superadmin — 19 catalog entries grouped across 8 tabs. */
export const SUPERADMIN_FILTERS: ReadonlyArray<NotificationFilterConfig> = [
  { value: 'all', label: 'All', special: 'all' },
  { value: 'unread', label: 'Unread', special: 'unread', showUnreadCount: true },
  {
    value: 'onboarding',
    label: 'Onboarding',
    categories: [NotificationCategory.Onboarding, NotificationCategory.Profile],
  },
  {
    value: 'finance',
    label: 'Finance',
    categories: [
      NotificationCategory.Dispute,
      NotificationCategory.Payout,
      NotificationCategory.Payment,
    ],
  },
  { value: 'bookings', label: 'Bookings', categories: [NotificationCategory.Booking] },
  { value: 'support', label: 'Support', categories: [NotificationCategory.Support] },
  { value: 'reviews', label: 'Reviews', categories: [NotificationCategory.Review] },
  { value: 'system', label: 'System', categories: [NotificationCategory.System] },
]

/**
 * Returns the canonical filter set for the given audience. Pass-through
 * to module-level constants so the returned array is reference-stable —
 * `useNotificationsPage`'s internal `useMemo` deps key on referential
 * equality, so this avoids needless filter re-evaluations on every render.
 */
export function getFiltersFor(
  audience: NotificationAudience
): ReadonlyArray<NotificationFilterConfig> {
  switch (audience) {
    case 'parent':
      return PARENT_FILTERS
    case 'provider':
      return PROVIDER_FILTERS
    case 'superadmin':
      return SUPERADMIN_FILTERS
  }
}
