import type { ProviderBookingGroupSummary, User } from '@world-schools/wc-types'
import type { Camp } from './camps'
import type { Session } from './sessions'
import type { GoogleBusinessProfile, OnboardingStatus } from './onboarding'
import type { CampStatistics } from '@/services/camps.services'
import type {
  ProviderReviewsListMeta,
  ProviderReviewSummary,
} from '@/services/provider-reviews.services'

export type ProviderDashboardState =
  | 'during-camp'
  | 'pre-camp'
  | 'high-demand'
  | 'first-requests'
  | 'active-healthy'
  | 'post-season'
  | 'quiet-period'
  | 'published-waiting'
  | 'camp-no-sessions'
  | 'fresh-start'

export interface ProviderDashboardSnapshot {
  user: User | null
  businessName: string | null
  camps: Camp[]
  statistics: CampStatistics | null
  sessions: Session[]
  bookingRequests: ProviderBookingGroupSummary[]
  upcomingBookings: ProviderBookingGroupSummary[]
  atCampBookings: ProviderBookingGroupSummary[]
  pastBookings: ProviderBookingGroupSummary[]
  onboardingStatus: OnboardingStatus | null
  businessProfile: GoogleBusinessProfile | null
  liveCamp: Camp | null
  recentReviews: ProviderReviewSummary[]
  reviewsMeta: ProviderReviewsListMeta
  unreadMessages: number
  now?: Date
}

export interface ChecklistItemViewModel {
  id: string
  label: string
  done: boolean
  actionHref?: string
}

export type GreetingTimeOfDay = 'morning' | 'afternoon' | 'evening'
