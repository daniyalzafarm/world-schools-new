import type { BlackoutDate, Duration } from '@/types/sessions'

/**
 * Validation utilities for sessions
 */

/**
 * Validate date range
 */
export function validateDateRange(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) return false

  const start = new Date(startDate)
  const end = new Date(endDate)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false
  if (start >= end) return false

  return true
}

/**
 * Validate duration weeks
 */
export function validateDurationWeeks(weeks: number): boolean {
  return weeks >= 1 && weeks <= 12
}

/**
 * Validate duration price
 */
export function validateDurationPrice(price: number): boolean {
  return price > 0 && price <= 1000000
}

/**
 * Validate durations array
 */
export function validateDurations(durations: Duration[]): boolean {
  if (!durations || durations.length === 0) return false

  return durations.every(
    duration => validateDurationWeeks(duration.weeks) && validateDurationPrice(duration.price)
  )
}

/**
 * Validate blackout date is within session range
 */
export function validateBlackoutDate(
  blackout: BlackoutDate,
  sessionStart: string,
  sessionEnd: string
): boolean {
  const blackoutStart = new Date(blackout.start)
  const blackoutEnd = new Date(blackout.end)
  const sessionStartDate = new Date(sessionStart)
  const sessionEndDate = new Date(sessionEnd)

  if (isNaN(blackoutStart.getTime()) || isNaN(blackoutEnd.getTime())) return false
  if (blackoutStart >= blackoutEnd) return false
  if (blackoutStart < sessionStartDate || blackoutEnd > sessionEndDate) return false

  return true
}

/**
 * Validate blackout dates array
 */
export function validateBlackoutDates(
  blackoutDates: BlackoutDate[],
  sessionStart: string,
  sessionEnd: string
): boolean {
  if (!blackoutDates || blackoutDates.length === 0) return true // Optional

  return blackoutDates.every(blackout => validateBlackoutDate(blackout, sessionStart, sessionEnd))
}

/**
 * Validate capacity
 */
export function validateCapacity(capacity?: number): boolean {
  if (capacity === undefined || capacity === null) return true // Optional (unlimited)
  return capacity >= 1 && capacity <= 10000
}

/**
 * Validate price
 */
export function validatePrice(price: number): boolean {
  return price > 0 && price <= 1000000
}

/**
 * Validate session name
 */
export function validateSessionName(name: string): boolean {
  if (!name || name.trim().length === 0) return false
  if (name.trim().length < 3) return false
  if (name.length > 100) return false
  return true
}

/**
 * Check if date is in the past
 */
export function isDateInPast(date: string): boolean {
  const dateObj = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return dateObj < today
}

/**
 * Check if date is in the future
 */
export function isDateInFuture(date: string): boolean {
  const dateObj = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return dateObj > today
}

/**
 * Validate that start date is not too far in the past
 */
export function validateStartDateNotTooOld(startDate: string, maxDaysInPast = 365): boolean {
  const start = new Date(startDate)
  const today = new Date()
  const diffTime = today.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays <= maxDaysInPast
}

/**
 * Validate that end date is not too far in the future
 */
export function validateEndDateNotTooFar(endDate: string, maxDaysInFuture = 730): boolean {
  const end = new Date(endDate)
  const today = new Date()
  const diffTime = end.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays <= maxDaysInFuture
}
