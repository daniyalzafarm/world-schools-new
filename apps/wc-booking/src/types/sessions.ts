// Session Types for wc-booking app

export type SessionType = 'flexible' | 'fixed'

// Blackout dates for flexible sessions
export interface BlackoutDate {
  start: string // ISO date string
  end: string // ISO date string
  reason?: string
}

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

  // Pricing & configuration
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
}
