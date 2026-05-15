import type { ProviderDashboardSnapshot, ProviderDashboardState } from '@/types/provider-dashboard'
import type { Session } from '@/types/sessions'
import { daysSince, daysUntil } from '@/utils/provider-dashboard'

const CONFIRMED_STATUSES = new Set(['accepted', 'deposit_paid', 'fully_paid'])
const PRE_CAMP_WINDOW_DAYS = 14
const POST_SEASON_WINDOW_DAYS = 30
const HIGH_DEMAND_OCCUPANCY = 0.9

function isLive(session: Session, now: Date): boolean {
  if (session.status !== 'published') return false
  const start = daysUntil(session.startDate, now)
  const end = daysSince(session.endDate, now)
  return start != null && end != null && start <= 0 && end <= 0
}

function occupancy(session: Session): number {
  if (!session.totalSpots || session.totalSpots <= 0) return 0
  const booked = session.bookedCount ?? 0
  return booked / session.totalSpots
}

/**
 * Classify a provider into one of the 10 dashboard states. First match wins.
 */
export function getProviderDashboardState(
  snapshot: ProviderDashboardSnapshot
): ProviderDashboardState {
  const now = snapshot.now ?? new Date()
  const { camps, sessions, bookingRequests, upcomingBookings, atCampBookings, pastBookings } =
    snapshot

  if (camps.length === 0) return 'fresh-start'

  if (sessions.length === 0) return 'camp-no-sessions'

  const publishedCampIds = new Set(camps.filter(c => c.status === 'published').map(c => c.id))
  const discoverableSessions = sessions.filter(
    s => s.status === 'published' && publishedCampIds.has(s.campId)
  )

  if (atCampBookings.length > 0 || discoverableSessions.some(s => isLive(s, now))) {
    return 'during-camp'
  }

  const hasPreCampBooking = upcomingBookings.some(b => {
    if (!CONFIRMED_STATUSES.has(b.status)) return false
    const d = daysUntil(b.session.startDate, now)
    return d != null && d >= 0 && d <= PRE_CAMP_WINDOW_DAYS
  })
  if (hasPreCampBooking) return 'pre-camp'

  const hasHotSession = discoverableSessions.some(s => occupancy(s) >= HIGH_DEMAND_OCCUPANCY)
  if (bookingRequests.length >= 1 && hasHotSession) return 'high-demand'

  const noLifetimeConfirmed =
    upcomingBookings.length === 0 && atCampBookings.length === 0 && pastBookings.length === 0
  if (bookingRequests.length >= 1 && noLifetimeConfirmed) return 'first-requests'

  if (upcomingBookings.some(b => CONFIRMED_STATUSES.has(b.status))) return 'active-healthy'

  const recentlyEnded = pastBookings.some(b => {
    const since = daysSince(b.session.endDate, now)
    return since != null && since >= 0 && since <= POST_SEASON_WINDOW_DAYS
  })
  if (recentlyEnded && upcomingBookings.length === 0) return 'post-season'

  if (pastBookings.length > 0 && upcomingBookings.length === 0) return 'quiet-period'

  if (discoverableSessions.length === 0) return 'camp-no-sessions'

  return 'published-waiting'
}
