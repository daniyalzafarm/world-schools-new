export type ParentStatus = 'active' | 'inactive' | 'new'
export type ParentTab = 'all' | 'active' | 'with_bookings' | 'new_this_month' | 'inactive'

export interface ChildSummary {
  id: string
  firstName: string
  lastName?: string
  dateOfBirth?: string
}

export interface ParentSummary {
  id: string
  firstName: string
  lastName: string
  email: string
  children: ChildSummary[]
  bookingCount: number
  upcomingBookingCount: number
  totalSpent: number
  avgSpent: number
  status: ParentStatus
  joinedAt: string
}

export interface ParentStats {
  totalParents: number
  childrenRegistered: number
  avgChildrenPerParent: number
  repeatBookingRate: number
  activeCount: number
  withBookingsCount: number
  newThisMonthCount: number
  inactiveCount: number
}

export interface ParentFilters {
  search?: string
  tab?: ParentTab
  country?: string
}

export interface GetParentsResponse {
  data: ParentSummary[]
  page: number
  limit: number
  total: number
  totalPages: number
}
