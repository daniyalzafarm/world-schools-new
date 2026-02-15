// Session Types for wc-booking app

// Session Enums
export type SessionDayType = 'full_day' | 'half_day'
export type PricingType = 'single' | 'age_group'
export type AvailabilityType = 'single' | 'age_group'
export type SessionStatus = 'draft' | 'published'

// Age Group Pricing
export interface AgeGroupPrice {
  ageGroupId: string
  price: number
}

// Age Group Availability
export interface AgeGroupSpots {
  ageGroupId: string
  spots: number
}

// Session Interface
export interface Session {
  id: string
  campId: string

  // Basic Fields
  name: string
  startDate: string // ISO date string
  endDate: string // ISO date string

  // Session Type (only for day camps)
  sessionDayType?: SessionDayType
  arrivalTime?: string // HH:MM format
  departureTime?: string // HH:MM format

  // Pricing
  pricingType: PricingType
  price?: number
  ageGroupPrices?: AgeGroupPrice[]

  // Availability
  availabilityType: AvailabilityType
  totalSpots?: number
  ageGroupSpots?: AgeGroupSpots[]

  // Status
  status: SessionStatus

  // Metadata
  sortOrder: number
  createdAt: string
  updatedAt: string

  // Computed fields (from backend)
  bookedCount?: number
}
