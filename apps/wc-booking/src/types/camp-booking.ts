import type { Child } from '@/types/child'
import type { Session } from '@/types/sessions'

export type BookingFlowStep = 'sessions' | 'children' | 'addons' | 'review-and-pay'

export interface CampBookingAddOn {
  addOnId: string
  campId: string
  name: string
  description?: string | null
  icon?: string | null
  type: string
  price: number
  currency: string
  pricingUnit: string
  maxQuantity?: number | null
  quantityUnit?: string | null
  minAge?: number | null
  maxAge?: number | null
  sortOrder: number
}

export interface CreateDraftBookingGroupRequest {
  campId: string
  sessionId: string
  childIds: string[]
  specialRequest?: string
  forceNew?: boolean
}

export type CampBookingAddOnSelectionMode = 'per_child' | 'per_child_qty' | 'qty'

export interface CampBookingChildQuantity {
  childId: string
  quantity: number
}

export interface CampBookingAddOnSelection {
  addOnId: string
  mode: CampBookingAddOnSelectionMode
  // `qty` mode
  quantity?: number
  // `per_child` mode
  childIds?: string[]
  // `per_child_qty` mode
  childQuantities?: CampBookingChildQuantity[]
}

export interface SaveBookingGroupAddOnsRequest {
  addOns: CampBookingAddOnSelection[]
  // Used to persist the review step marker for reload restoration.
  // If omitted, we keep the current bookingGroup.specialRequest value.
  specialRequest?: string
}

export interface DraftBookingChild {
  id: string
  childId: string
}

export interface DraftBookingGroupResponse {
  bookingGroupId: string
  status: string
  bookings: DraftBookingChild[]
}

export interface BookingGroupDetails {
  id: string
  status: string
  campId: string
  sessionId: string
  specialRequest?: string | null
  bookings: {
    id: string
    childId: string
    addOns?: { campId: string; addOnId: string; quantity: number }[]
  }[]
}

export interface DraftBookingPreview {
  id: string
  sessionId: string
  sessionName?: string | null
  updatedAt: string
  totalAmount: number
  childrenCount: number
}

/** Parent dashboard list item — matches GET /user/booking-groups */
export type ParentBookingGroupStatus =
  | 'draft'
  | 'request'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'deposit_paid'
  | 'fully_paid'
  | 'at_camp'
  | 'completed'
  | 'cancelled'

export interface ParentBookingGroupSummaryChild {
  id: string
  firstName: string
  dateOfBirth: string | null
  photoUrl: string | null
}

export interface ParentBookingGroupSummary {
  id: string
  status: ParentBookingGroupStatus
  totalAmount: number
  requestedAt: string
  respondedAt: string | null
  expiresAt: string | null
  updatedAt: string
  camp: {
    name: string
    slug: string
    coverImageUrl: string | null
  }
  session: {
    name: string
    startDate: string
    endDate: string
  }
  children: ParentBookingGroupSummaryChild[]
}

export interface BookingStepChildrenState {
  selectedChildIds: string[]
  children: Child[]
}

export interface BookingStepSessionsState {
  sessions: Session[]
  selectedSessionId: string | null
}
