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

/** GET /user/booking-groups/:id — parent detail (hydration + booking detail page). */
export interface ParentBookingGroupBookingLine {
  id: string
  childId: string
  basePrice: number
  discountAmount: number
  totalPrice: number
  addOns: { campId: string; addOnId: string; quantity: number }[]
  child: {
    id: string
    firstName: string
    dateOfBirth: string | null
    photoUrl: string | null
  }
}

export type SessionDayTypeApi = 'full_day' | 'half_day' | null

export interface ParentBookingGroupDetail {
  id: string
  status: ParentBookingGroupStatus
  campId: string
  sessionId: string
  providerId: string
  specialRequest?: string | null
  subtotalAmount: number
  discountTotal: number
  totalAmount: number
  depositAmount: number | null
  paidAmount: number
  refundedAmount: number
  requestedAt: string
  respondedAt: string | null
  expiresAt: string | null
  updatedAt: string
  camp: {
    id: string
    name: string
    slug: string
    coverImageUrl: string | null
    locationLat: number | null
    locationLng: number | null
    locationName: string | null
    locationAddress: string | null
  }
  session: {
    name: string
    startDate: string
    endDate: string
    sessionDayType: SessionDayTypeApi
    arrivalTime: string | null
    departureTime: string | null
  }
  provider: {
    legalCompanyName: string | null
  }
  bookings: ParentBookingGroupBookingLine[]
}

/** @deprecated Use ParentBookingGroupDetail — alias kept for existing imports. */
export type BookingGroupDetails = ParentBookingGroupDetail

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
