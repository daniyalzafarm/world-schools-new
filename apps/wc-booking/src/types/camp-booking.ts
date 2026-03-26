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

export interface BookingStepChildrenState {
  selectedChildIds: string[]
  children: Child[]
}

export interface BookingStepSessionsState {
  sessions: Session[]
  selectedSessionId: string | null
}
