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
  bookingGroupNumber: string
  status: BookingGroupStatus
  bookings: {
    id: string
    childId: string
    bookingNumber: string
  }[]
}

export type SessionDayTypeApi = 'full_day' | 'half_day' | null

/** GET /provider/booking-groups — provider dashboard list row */
export interface ProviderBookingGroupSummary {
  id: string
  bookingGroupNumber: string
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
  bookingNumber: string
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
    lastName: string | null
    nickname: string | null
    dateOfBirth: string | null
    photoUrl: string | null
    gender: string | null
    languages: string[]
    schoolYear: string | null
    schoolCountry: string | null
    medicalInfo: unknown | null
    emergencyContacts: unknown
    campPreferences: unknown | null
    interestLabels: string[]
  }
}

/** GET /provider/booking-groups/:id — provider detail (drawer) */
export interface ProviderBookingGroupDetail {
  id: string
  bookingGroupNumber: string
  status: BookingGroupStatus
  currency: string
  campId: string
  sessionId: string
  providerId: string
  specialRequest?: string | null
  internalNotes: string | null
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
  discountDetails: unknown | null
  parent: {
    id: string
    userId: string
    displayName: string
    firstName: string | null
    lastName: string | null
    email: string
    phone: string | null
    phoneVerified: boolean
    profilePhotoUrl: string | null
    address: string | null
    languages: string[]
    primaryNationality: string | null
    secondaryNationality: string | null
    city: string | null
    state: string | null
    postalCode: string | null
    country: string | null
    emailVerified: boolean
  }
  parentStats: {
    completedBookingGroupsCount: number
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
    durationWeeks: number | null
    spotsRemaining: number | null
    ageRangeLabel: string | null
  }
  provider: {
    legalCompanyName: string | null
  }
  messaging: {
    parentUserId: string
    conversationId: string | null
  }
  bookings: ProviderBookingGroupBookingLine[]
}
