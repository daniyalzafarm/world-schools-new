/**
 * Frontend validation utilities for discount forms
 * These validators mirror the backend validation rules
 */

export interface ValidationErrors {
  name?: string
  value?: string
  validFrom?: string
  validUntil?: string
  details?: string
  secondChild?: string
  thirdChild?: string
  fourthPlusChild?: string
  minimumWeeks?: string
  minimumChildren?: string
  code?: string
  usageLimit?: string
}

/**
 * Validate discount name
 */
export function validateName(name: string | undefined): string | undefined {
  if (!name || name.trim() === '') {
    return 'Discount name is required'
  }
  if (name.length > 30) {
    return 'Discount name cannot exceed 30 characters'
  }
  return undefined
}

/**
 * Validate discount percentage value
 */
export function validateValue(value: number | undefined): string | undefined {
  if (value === undefined || value === null) {
    return 'Discount percentage is required'
  }
  if (isNaN(value)) {
    return 'Discount value must be a number'
  }
  if (value < 1) {
    return 'Discount value must be at least 1%'
  }
  if (value > 100) {
    return 'Discount value cannot exceed 100%'
  }
  return undefined
}

/**
 * Validate details field
 */
export function validateDetails(details: string | undefined): string | undefined {
  if (details && details.length > 200) {
    return 'Details cannot exceed 200 characters'
  }
  return undefined
}

/**
 * Validate date is in the future
 */
export function validateDateInFuture(date: string | undefined): string | undefined {
  if (!date) {
    return 'Date is required'
  }

  const selectedDate = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (selectedDate < today) {
    return 'Date must be in the future'
  }

  return undefined
}

/**
 * Validate validUntil is after validFrom
 */
export function validateDateAfter(
  validFrom: string | undefined,
  validUntil: string | undefined
): string | undefined {
  if (!validFrom || !validUntil) {
    return undefined // Other validators will catch missing dates
  }

  const fromDate = new Date(validFrom)
  const untilDate = new Date(validUntil)

  if (untilDate <= fromDate) {
    return 'Valid until must be after valid from date'
  }

  return undefined
}

/**
 * Validate promo code format
 */
export function validatePromoCode(code: string | undefined): string | undefined {
  if (!code || code.trim() === '') {
    return 'Promo code is required'
  }
  if (code.length > 20) {
    return 'Promo code cannot exceed 20 characters'
  }
  if (!/^[A-Z0-9]+$/.test(code)) {
    return 'Promo code must contain only uppercase letters and numbers'
  }
  return undefined
}

/**
 * Validate integer field (for minimumWeeks, minimumChildren, usageLimit)
 */
export function validateInteger(
  value: number | undefined,
  fieldName: string,
  min = 1
): string | undefined {
  if (value === undefined || value === null) {
    return `${fieldName} is required`
  }
  if (isNaN(value)) {
    return `${fieldName} must be a number`
  }
  if (!Number.isInteger(value)) {
    return `${fieldName} must be an integer`
  }
  if (value < min) {
    return `${fieldName} must be at least ${min}`
  }
  return undefined
}

/**
 * Validate sibling discount tiers are in ascending order
 */
export function validateSiblingTiers(
  secondChild: number | undefined,
  thirdChild: number | undefined,
  fourthPlusChild: number | undefined
): { secondChild?: string; thirdChild?: string; fourthPlusChild?: string } {
  const errors: { secondChild?: string; thirdChild?: string; fourthPlusChild?: string } = {}

  // First validate each value individually
  const secondError = validateValue(secondChild)
  const thirdError = validateValue(thirdChild)
  const fourthError = validateValue(fourthPlusChild)

  if (secondError) errors.secondChild = secondError
  if (thirdError) errors.thirdChild = thirdError
  if (fourthError) errors.fourthPlusChild = fourthError

  // If all values are valid, check ascending order
  if (
    !secondError &&
    !thirdError &&
    !fourthError &&
    secondChild !== undefined &&
    thirdChild !== undefined &&
    fourthPlusChild !== undefined
  ) {
    if (thirdChild < secondChild) {
      errors.thirdChild = 'Third child discount must be greater than or equal to second child'
    }
    if (fourthPlusChild < thirdChild) {
      errors.fourthPlusChild = 'Fourth+ child discount must be greater than or equal to third child'
    }
  }

  return errors
}
