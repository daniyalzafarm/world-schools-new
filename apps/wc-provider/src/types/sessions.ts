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

// DTOs for creating sessions
export interface CreateSessionDto {
  name: string
  startDate: string
  endDate: string

  // Session Type (only for day camps)
  sessionDayType?: SessionDayType
  arrivalTime?: string
  departureTime?: string

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
}

// DTOs for updating sessions
export interface UpdateSessionDto {
  name?: string
  startDate?: string
  endDate?: string

  // Session Type (only for day camps)
  sessionDayType?: SessionDayType
  arrivalTime?: string
  departureTime?: string

  // Pricing
  pricingType?: PricingType
  price?: number
  ageGroupPrices?: AgeGroupPrice[]

  // Availability
  availabilityType?: AvailabilityType
  totalSpots?: number
  ageGroupSpots?: AgeGroupSpots[]

  // Status
  status?: SessionStatus
}

// API Response types
export interface SessionsResponse {
  sessions: Session[]
  total: number
}

export interface SessionResponse {
  session: Session
  message: string
}

export interface DeleteSessionResponse {
  message: string
  affectedBookings: number
}

// Form state types for UI
export interface SessionFormData {
  name: string
  startDate: Date | null
  endDate: Date | null

  // Session Type (only for day camps)
  sessionDayType: SessionDayType | null
  arrivalTime: string
  departureTime: string

  // Pricing
  pricingType: PricingType
  price: number | null
  ageGroupPrices: AgeGroupPrice[]

  // Availability
  availabilityType: AvailabilityType
  totalSpots: number | null
  ageGroupSpots: AgeGroupSpots[]

  // Status
  status: SessionStatus
}

// Validation errors
export interface SessionValidationError {
  field: string
  message: string
}
