import type { DashboardState } from '@world-schools/wc-types'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'
import type { DashboardSnapshot } from '@/types/dashboard'
import { daysSince, daysUntil } from '@/utils/dashboard'

const CONFIRMED_STATUSES = new Set(['accepted', 'deposit_paid', 'fully_paid'])
const PRE_CAMP_WINDOW_DAYS = 14
const POST_CAMP_WINDOW_DAYS = 30

function hasUpcomingConfirmed(bookings: ParentBookingGroupSummary[], now: Date): boolean {
  return bookings.some(b => {
    if (!CONFIRMED_STATUSES.has(b.status)) return false
    const d = daysUntil(b.session.startDate, now)
    return d != null && d >= 0
  })
}

/**
 * Classify a parent into one of the 10 dashboard states. First match wins.
 * `quotes-pending` and `decision-time` are reserved for a future quote flow
 * and are never produced today.
 */
export function getDashboardState(snapshot: DashboardSnapshot): DashboardState {
  const now = snapshot.now ?? new Date()
  const { children, bookings, wishlists } = snapshot

  // 1. During camp
  if (bookings.some(b => b.status === 'at_camp')) return 'during-camp'

  // 2. Pre-camp — confirmed booking starting within the next 14 days
  const preCamp = bookings.some(b => {
    if (!CONFIRMED_STATUSES.has(b.status)) return false
    const d = daysUntil(b.session.startDate, now)
    return d != null && d >= 0 && d <= PRE_CAMP_WINDOW_DAYS
  })
  if (preCamp) return 'pre-camp'

  const completedCount = bookings.filter(b => b.status === 'completed').length
  const confirmedLifetime = bookings.filter(
    b => CONFIRMED_STATUSES.has(b.status) || b.status === 'completed' || b.status === 'at_camp'
  ).length

  // 3. First booking — exactly one lifetime confirmed booking, none completed
  if (confirmedLifetime === 1 && completedCount === 0) return 'first-booking'

  // 4. Post-camp — recent completion AND no upcoming confirmed bookings
  const recentlyCompleted = bookings.some(b => {
    if (b.status !== 'completed') return false
    const since = daysSince(b.session.endDate, now)
    return since != null && since >= 0 && since <= POST_CAMP_WINDOW_DAYS
  })
  if (recentlyCompleted && !hasUpcomingConfirmed(bookings, now)) return 'post-camp'

  // 5. Returning user
  if (completedCount >= 2) return 'returning-user'

  // 6. Browsing — has wishlists or a draft booking in flight
  const hasDraftBooking = bookings.some(b => b.status === 'draft')
  if (wishlists.length > 0 || hasDraftBooking) return 'browsing'

  // 7. Profile-ready — has at least one child profile (regardless of how
  // complete). Any existing child means this is not a first-time setup.
  if (children.length > 0) return 'profile-ready'

  // 8. Fresh start fallback — no children yet
  return 'fresh-start'
}
