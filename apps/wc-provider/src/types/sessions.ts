// Session Types
export type SessionType = 'flexible' | 'fixed'

// Multi-day discount tier
export interface DiscountTier {
  minDays: number
  maxDays?: number
  discountPercent: number
}

// Day-of-week pricing
export interface DayOfWeekPricing {
  dayOfWeek: number // 0 = Sunday, 1 = Monday, etc.
  price: number
}

// Age range
export interface AgeRange {
  min: number
  max: number
}

// Gender type for sessions
export type SessionGender = 'all' | 'male' | 'female'

// Blackout dates for flexible sessions
export interface BlackoutDate {
  start: string // ISO date string
  end: string // ISO date string
  reason?: string
}

// Base Session interface
export interface Session {
  id: string
  campId: string
  type: SessionType
  name: string
  description?: string
  isActive: boolean
  capacity?: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// Flexible Session
export interface FlexibleSession extends Session {
  type: 'flexible'
  startDate: string // ISO date string - booking window start
  endDate: string // ISO date string - booking window end
  blackoutDates?: BlackoutDate[]

  // New fields for enhanced flexible sessions
  basePricePerDay?: number
  requireConsecutiveDays?: boolean
  minDaysLimit?: number
  maxDaysLimit?: number
  availableDaysOfWeek?: number[] // Array of day indices (0 = Sunday, 1 = Monday, etc.)
  specificStartDays?: number[] // Which days of the week sessions can begin
  discountTiers?: DiscountTier[]
  dayOfWeekPricing?: DayOfWeekPricing[]
  ageRange?: AgeRange
  unlimitedCapacity?: boolean
  gender?: SessionGender
  boysCapacity?: number
  girlsCapacity?: number
  separateGenderCapacity?: boolean
}

// Fixed Session
export interface FixedSession extends Session {
  type: 'fixed'
  sessionStartDate: string // ISO date string - actual session start
  sessionEndDate: string // ISO date string - actual session end
  price: number
  bookedCount?: number // Number of bookings for this session
}

// DTOs for creating sessions
export interface CreateFlexibleSessionDto {
  name: string
  description?: string
  startDate: string
  endDate: string
  capacity?: number
  blackoutDates?: BlackoutDate[]

  // New fields
  basePricePerDay?: number
  requireConsecutiveDays?: boolean
  minDaysLimit?: number
  maxDaysLimit?: number
  availableDaysOfWeek?: number[]
  specificStartDays?: number[]
  discountTiers?: DiscountTier[]
  dayOfWeekPricing?: DayOfWeekPricing[]
  ageRange?: AgeRange
  unlimitedCapacity?: boolean
  gender?: SessionGender
  boysCapacity?: number
  girlsCapacity?: number
  separateGenderCapacity?: boolean
}

export interface CreateFixedSessionDto {
  name: string
  description?: string
  sessionStartDate: string
  sessionEndDate: string
  price: number
  capacity?: number
}

// DTOs for updating sessions
export interface UpdateFlexibleSessionDto {
  name?: string
  description?: string
  startDate?: string
  endDate?: string
  capacity?: number
  blackoutDates?: BlackoutDate[]
  isActive?: boolean

  // New fields
  basePricePerDay?: number
  requireConsecutiveDays?: boolean
  minDaysLimit?: number
  maxDaysLimit?: number
  availableDaysOfWeek?: number[]
  specificStartDays?: number[]
  discountTiers?: DiscountTier[]
  dayOfWeekPricing?: DayOfWeekPricing[]
  ageRange?: AgeRange
  unlimitedCapacity?: boolean
  gender?: SessionGender
  boysCapacity?: number
  girlsCapacity?: number
  separateGenderCapacity?: boolean
}

export interface UpdateFixedSessionDto {
  name?: string
  description?: string
  sessionStartDate?: string
  sessionEndDate?: string
  price?: number
  capacity?: number
  isActive?: boolean
}

// DTO for setting session type
export interface UpdateSessionTypeDto {
  sessionType: SessionType
}

// API Response types
export interface SessionTypeResponse {
  sessionType: SessionType | null
  canChange: boolean
}

export interface FlexibleSessionsResponse {
  sessions: FlexibleSession[]
  total: number
}

export interface FixedSessionsResponse {
  sessions: FixedSession[]
  total: number
}

export interface SessionResponse {
  session: FlexibleSession | FixedSession
  message: string
}

export interface DeleteSessionResponse {
  message: string
  affectedBookings: number
}

// Form state types for UI
export interface FlexibleSessionFormData {
  name: string
  description: string
  startDate: Date | null
  endDate: Date | null
  capacity: number | null
  blackoutDates: BlackoutDate[]

  // New fields
  basePricePerDay: number | null
  requireConsecutiveDays: boolean
  minDaysLimit: number | null
  maxDaysLimit: number | null
  availableDaysOfWeek: number[]
  specificStartDays: number[]
  discountTiers: DiscountTier[]
  dayOfWeekPricing: DayOfWeekPricing[]
  ageRange: AgeRange | null
  unlimitedCapacity: boolean
  gender: SessionGender
  minParticipantsPerBooking: number | null
  maxParticipantsPerBooking: number | null
}

export interface FixedSessionFormData {
  name: string
  description: string
  sessionStartDate: Date | null
  sessionEndDate: Date | null
  price: number | null
  capacity: number | null
}

// Validation errors
export interface SessionValidationError {
  field: string
  message: string
}
