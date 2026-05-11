import type { Wishlist } from '@/types/wishlists'
import type { Child } from '@/types/child'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'
import type { AttendedEligible } from '@/services/reviews.services'
import type { User } from '@world-schools/wc-types'

export interface DashboardSnapshot {
  user: User | null
  children: Child[]
  bookings: ParentBookingGroupSummary[]
  wishlists: Wishlist[]
  eligibleReviews: AttendedEligible[]
  now?: Date
}

export interface ChecklistItemViewModel {
  id: string
  label: string
  done: boolean
  actionHref?: string
}

export type GreetingTimeOfDay = 'morning' | 'afternoon' | 'evening'
