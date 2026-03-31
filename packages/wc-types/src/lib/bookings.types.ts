export type BookingGroupStatus =
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

export interface CreateDraftBookingGroupDto {
  campId: string
  sessionId: string
  childIds: string[]
  specialRequest?: string
}

export interface DraftBookingGroupResponse {
  bookingGroupId: string
  status: BookingGroupStatus
  bookings: {
    id: string
    childId: string
  }[]
}

export type SessionDayTypeApi = 'full_day' | 'half_day' | null

/** GET /provider/booking-groups — provider dashboard list row */
export interface ProviderBookingGroupSummary {
  id: string
  status: BookingGroupStatus
  totalAmount: number
  currency: string
  requestedAt: string
  respondedAt: string | null
  expiresAt: string | null
  updatedAt: string
  parent: {
    displayName: string
    email: string
    phone: string | null
  }
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
  children: {
    id: string
    firstName: string
    dateOfBirth: string | null
    photoUrl: string | null
  }[]
}

export interface ProviderBookingGroupBookingLine {
  id: string
  childId: string
  basePrice: number
  discountAmount: number
  totalPrice: number
  providerNote: string | null
  respondedAt: string | null
  addOns: {
    campId: string
    addOnId: string
    quantity: number
    name: string
    unitPrice: number
    lineTotal: number
  }[]
  child: {
    id: string
    firstName: string
    dateOfBirth: string | null
    photoUrl: string | null
  }
}

/** GET /provider/booking-groups/:id — provider detail (drawer) */
export interface ProviderBookingGroupDetail {
  id: string
  status: BookingGroupStatus
  currency: string
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
  parent: {
    displayName: string
    email: string
    phone: string | null
  }
  camp: {
    id: string
    name: string
    slug: string
    coverImageUrl: string | null
    locationLat: number | null
    locationLng: number | null
    locationName: string | null
    locationAddress: string | null
    locationPlaceId: string | null
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
  bookings: ProviderBookingGroupBookingLine[]
}
