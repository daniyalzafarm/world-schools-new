import type { AgeGroupPrice, AgeGroupSpots, AvailabilityType, PricingType } from '@/types/sessions'

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
 * Validate total spots
 */
export function validateTotalSpots(totalSpots?: number): boolean {
  if (totalSpots === undefined || totalSpots === null) return true // Optional (unlimited)
  return totalSpots >= 1 && totalSpots <= 10000
}

/**
 * Validate pricing type
 */
export function validatePricingType(pricingType: PricingType): boolean {
  return pricingType === 'single' || pricingType === 'age_group'
}

/**
 * Validate availability type
 */
export function validateAvailabilityType(availabilityType: AvailabilityType): boolean {
  return availabilityType === 'single' || availabilityType === 'age_group'
}

/**
 * Validate age group prices array
 */
export function validateAgeGroupPrices(ageGroupPrices?: AgeGroupPrice[]): boolean {
  if (!ageGroupPrices || ageGroupPrices.length === 0) return false // Required for age_group pricing
  if (ageGroupPrices.length < 2) return false // Must have at least 2 age groups

  // Validate each price entry
  return ageGroupPrices.every(ag => {
    return ag.ageGroupId && ag.ageGroupId.trim().length > 0 && ag.price > 0 && ag.price <= 1000000
  })
}

/**
 * Validate age group spots array
 */
export function validateAgeGroupSpots(ageGroupSpots?: AgeGroupSpots[]): boolean {
  if (!ageGroupSpots || ageGroupSpots.length === 0) return false // Required for age_group availability
  if (ageGroupSpots.length < 2) return false // Must have at least 2 age groups

  // Validate each spots entry
  return ageGroupSpots.every(ag => {
    return ag.ageGroupId && ag.ageGroupId.trim().length > 0 && ag.spots >= 1 && ag.spots <= 10000
  })
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
