import type { FixedSession, FlexibleSession } from '@/types/sessions'

/**
 * Calculation utilities for sessions
 */

/**
 * Calculate number of days between two dates
 */
export function calculateDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

/**
 * Calculate number of weeks between two dates
 */
export function calculateWeeksBetween(startDate: string, endDate: string): number {
  const days = calculateDaysBetween(startDate, endDate)
  return Math.floor(days / 7)
}

/**
 * Calculate duration in days from weeks and optional days
 */
export function calculateDurationDays(weeks: number, days = 0): number {
  return weeks * 7 + days
}

/**
 * Calculate total price for a duration
 */
export function calculateTotalPrice(basePrice: number, quantity = 1): number {
  return basePrice * quantity
}

/**
 * Calculate price per day
 */
export function calculatePricePerDay(totalPrice: number, days: number): number {
  if (days === 0) return 0
  return totalPrice / days
}

/**
 * Calculate price per week
 */
export function calculatePricePerWeek(totalPrice: number, weeks: number): number {
  if (weeks === 0) return 0
  return totalPrice / weeks
}

/**
 * Calculate available spots (capacity - booked)
 */
export function calculateAvailableSpots(capacity?: number, booked = 0): number | null {
  if (capacity === undefined || capacity === null) return null // Unlimited
  return Math.max(0, capacity - booked)
}

/**
 * Calculate capacity percentage
 */
export function calculateCapacityPercentage(capacity?: number, booked = 0): number | null {
  if (capacity === undefined || capacity === null) return null // Unlimited
  if (capacity === 0) return 0
  return Math.round((booked / capacity) * 100)
}

/**
 * Check if session is full
 */
export function isSessionFull(capacity?: number, booked = 0): boolean {
  if (capacity === undefined || capacity === null) return false // Unlimited
  return booked >= capacity
}

/**
 * Check if session is almost full (>= 80% capacity)
 */
export function isSessionAlmostFull(capacity?: number, booked = 0): boolean {
  if (capacity === undefined || capacity === null) return false // Unlimited
  const percentage = calculateCapacityPercentage(capacity, booked)
  return percentage !== null && percentage >= 80
}

/**
 * Get capacity status
 */
export function getCapacityStatus(
  capacity?: number,
  booked = 0
): 'available' | 'almost-full' | 'full' {
  if (isSessionFull(capacity, booked)) return 'full'
  if (isSessionAlmostFull(capacity, booked)) return 'almost-full'
  return 'available'
}

/**
 * Calculate session duration in days (for fixed sessions)
 */
export function calculateSessionDuration(session: FixedSession): number {
  return calculateDaysBetween(session.sessionStartDate, session.sessionEndDate)
}

/**
 * Calculate session duration in weeks (for fixed sessions)
 */
export function calculateSessionDurationWeeks(session: FixedSession): number {
  return calculateWeeksBetween(session.sessionStartDate, session.sessionEndDate)
}

/**
 * Check if session is active (current date is within session range)
 */
export function isSessionActive(startDate: string, endDate: string): boolean {
  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(endDate)
  return now >= start && now <= end
}

/**
 * Check if session is upcoming (start date is in the future)
 */
export function isSessionUpcoming(startDate: string): boolean {
  const now = new Date()
  const start = new Date(startDate)
  return start > now
}

/**
 * Check if session is past (end date is in the past)
 */
export function isSessionPast(endDate: string): boolean {
  const now = new Date()
  const end = new Date(endDate)
  return end < now
}
