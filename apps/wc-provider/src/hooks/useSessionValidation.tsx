'use client'

import { useMemo } from 'react'
import type { AgeRange, BlackoutDate, DayOfWeekPricing, DiscountTier } from '@/types/sessions'

interface ValidationError {
  field: string
  message: string
}

interface UseSessionValidationReturn {
  validateSessionName: (name: string) => string | null
  validateDateRange: (startDate: string, endDate: string) => string | null
  validatePricing: (price: number) => string | null
  validateCapacity: (capacity?: number) => string | null
  validateBlackoutDates: (
    blackoutDates: BlackoutDate[],
    sessionStart: string,
    sessionEnd: string
  ) => string | null
  validateAgeRange: (ageRange: AgeRange | null) => string | null
  validateGenderCapacity: (
    boysCapacity: number | null,
    girlsCapacity: number | null,
    totalCapacity: number | null,
    separateGenderCapacity: boolean
  ) => string | null
  validateDaysLimit: (minDays: number | null, maxDays: number | null) => string | null
  validateDiscountTiers: (tiers: DiscountTier[]) => string | null
  validateBasePricePerDay: (price: number | null, isRequired?: boolean) => string | null
  validateConditionalCapacity: (
    capacity: number | null,
    unlimitedCapacity: boolean
  ) => string | null
  validateDayOfWeekPricing: (pricing: DayOfWeekPricing[]) => string | null
  validateFlexibleSession: (data: {
    name: string
    startDate: string
    endDate: string
  }) => ValidationError[]
  validateFixedSession: (data: {
    name: string
    startDate: string
    endDate: string
    price: number
    capacity?: number
  }) => ValidationError[]
}

/**
 * Custom hook for session form validation
 * Provides validation functions for all session fields
 */
export function useSessionValidation(): UseSessionValidationReturn {
  // Validate session name
  const validateSessionName = useMemo(
    () =>
      (name: string): string | null => {
        if (!name || name.trim().length === 0) {
          return 'Session name is required'
        }
        if (name.trim().length < 3) {
          return 'Session name must be at least 3 characters'
        }
        if (name.length > 100) {
          return 'Session name must be less than 100 characters'
        }
        return null
      },
    []
  )

  // Validate date range
  const validateDateRange = useMemo(
    () =>
      (startDate: string, endDate: string): string | null => {
        if (!startDate) {
          return 'Start date is required'
        }
        if (!endDate) {
          return 'End date is required'
        }

        const start = new Date(startDate)
        const end = new Date(endDate)

        if (isNaN(start.getTime())) {
          return 'Invalid start date'
        }
        if (isNaN(end.getTime())) {
          return 'Invalid end date'
        }
        if (start >= end) {
          return 'End date must be after start date'
        }

        return null
      },
    []
  )

  // Validate pricing
  const validatePricing = useMemo(
    () =>
      (price: number): string | null => {
        if (price === undefined || price === null) {
          return 'Price is required'
        }
        if (price <= 0) {
          return 'Price must be greater than 0'
        }
        if (price > 1000000) {
          return 'Price seems unreasonably high'
        }
        return null
      },
    []
  )

  // Validate capacity
  const validateCapacity = useMemo(
    () =>
      (capacity?: number): string | null => {
        if (capacity === undefined || capacity === null) {
          return null // Capacity is optional (unlimited)
        }
        if (capacity < 1) {
          return 'Capacity must be at least 1'
        }
        if (capacity > 10000) {
          return 'Capacity seems unreasonably high'
        }
        return null
      },
    []
  )

  // Validate blackout dates
  const validateBlackoutDates = useMemo(
    () =>
      (blackoutDates: BlackoutDate[], sessionStart: string, sessionEnd: string): string | null => {
        if (!blackoutDates || blackoutDates.length === 0) {
          return null // Blackout dates are optional
        }

        const sessionStartDate = new Date(sessionStart)
        const sessionEndDate = new Date(sessionEnd)

        for (const blackout of blackoutDates) {
          const blackoutStart = new Date(blackout.start)
          const blackoutEnd = new Date(blackout.end)

          if (isNaN(blackoutStart.getTime()) || isNaN(blackoutEnd.getTime())) {
            return 'Invalid blackout date'
          }

          if (blackoutStart >= blackoutEnd) {
            return 'Blackout end date must be after start date'
          }

          if (blackoutStart < sessionStartDate || blackoutEnd > sessionEndDate) {
            return 'Blackout dates must be within session date range'
          }
        }

        return null
      },
    []
  )

  // Validate complete flexible session
  const validateFlexibleSession = useMemo(
    () =>
      (data: { name: string; startDate: string; endDate: string }): ValidationError[] => {
        const errors: ValidationError[] = []

        const nameError = validateSessionName(data.name)
        if (nameError) {
          errors.push({ field: 'name', message: nameError })
        }

        const dateError = validateDateRange(data.startDate, data.endDate)
        if (dateError) {
          errors.push({ field: 'dates', message: dateError })
        }

        return errors
      },
    [validateSessionName, validateDateRange]
  )

  // Validate complete fixed session
  const validateFixedSession = useMemo(
    () =>
      (data: {
        name: string
        startDate: string
        endDate: string
        price: number
        capacity?: number
      }): ValidationError[] => {
        const errors: ValidationError[] = []

        const nameError = validateSessionName(data.name)
        if (nameError) {
          errors.push({ field: 'name', message: nameError })
        }

        const dateError = validateDateRange(data.startDate, data.endDate)
        if (dateError) {
          errors.push({ field: 'dates', message: dateError })
        }

        const priceError = validatePricing(data.price)
        if (priceError) {
          errors.push({ field: 'price', message: priceError })
        }

        const capacityError = validateCapacity(data.capacity)
        if (capacityError) {
          errors.push({ field: 'capacity', message: capacityError })
        }

        return errors
      },
    [validateSessionName, validateDateRange, validatePricing, validateCapacity]
  )

  // Validate age range
  const validateAgeRange = useMemo(
    () =>
      (ageRange: AgeRange | null): string | null => {
        if (!ageRange) return null // Age range is optional

        if (ageRange.min < 0) {
          return 'Minimum age cannot be negative'
        }
        if (ageRange.max < 0) {
          return 'Maximum age cannot be negative'
        }
        if (ageRange.min > ageRange.max) {
          return 'Minimum age cannot be greater than maximum age'
        }
        if (ageRange.max > 100) {
          return 'Maximum age seems unreasonably high'
        }

        return null
      },
    []
  )

  // Validate gender capacity
  const validateGenderCapacity = useMemo(
    () =>
      (
        boysCapacity: number | null,
        girlsCapacity: number | null,
        totalCapacity: number | null,
        separateGenderCapacity: boolean
      ): string | null => {
        if (!separateGenderCapacity) return null // Not using separate gender capacity

        if (!totalCapacity) {
          return 'Total capacity must be set to use separate gender capacity'
        }

        if (boysCapacity === null && girlsCapacity === null) {
          return 'At least one gender capacity must be set'
        }

        if (boysCapacity !== null && boysCapacity < 0) {
          return 'Boys capacity cannot be negative'
        }

        if (girlsCapacity !== null && girlsCapacity < 0) {
          return 'Girls capacity cannot be negative'
        }

        if (boysCapacity !== null && girlsCapacity !== null) {
          const sum = boysCapacity + girlsCapacity
          if (sum !== totalCapacity) {
            return `Boys capacity (${boysCapacity}) + Girls capacity (${girlsCapacity}) must equal total capacity (${totalCapacity})`
          }
        }

        return null
      },
    []
  )

  // Validate days limit
  const validateDaysLimit = useMemo(
    () =>
      (minDays: number | null, maxDays: number | null): string | null => {
        if (minDays === null && maxDays === null) return null // Both optional

        if (minDays !== null && minDays < 1) {
          return 'Minimum days must be at least 1'
        }

        if (maxDays !== null && maxDays < 1) {
          return 'Maximum days must be at least 1'
        }

        if (minDays !== null && maxDays !== null && minDays > maxDays) {
          return 'Minimum days cannot be greater than maximum days'
        }

        return null
      },
    []
  )

  // Validate discount tiers
  const validateDiscountTiers = useMemo(
    () =>
      (tiers: DiscountTier[]): string | null => {
        if (!tiers || tiers.length === 0) return null // Optional

        for (let i = 0; i < tiers.length; i++) {
          const tier = tiers[i]

          if (tier.minDays < 1) {
            return `Discount tier ${i + 1}: Minimum days must be at least 1`
          }

          if (tier.maxDays !== undefined && tier.maxDays < tier.minDays) {
            return `Discount tier ${i + 1}: Maximum days cannot be less than minimum days`
          }

          if (tier.discountPercent < 0 || tier.discountPercent > 100) {
            return `Discount tier ${i + 1}: Discount percent must be between 0 and 100`
          }

          // Check for overlapping tiers
          for (let j = i + 1; j < tiers.length; j++) {
            const otherTier = tiers[j]
            const tier1Max = tier.maxDays ?? Infinity
            const tier2Max = otherTier.maxDays ?? Infinity

            if (
              (tier.minDays <= otherTier.minDays && tier1Max >= otherTier.minDays) ||
              (otherTier.minDays <= tier.minDays && tier2Max >= tier.minDays)
            ) {
              return `Discount tiers ${i + 1} and ${j + 1} overlap`
            }
          }
        }

        return null
      },
    []
  )

  // Validate base price per day (now required by default)
  const validateBasePricePerDay = useMemo(
    () =>
      (price: number | null, isRequired = true): string | null => {
        if (price === null || price === undefined) {
          return isRequired ? 'Base price per day is required' : null
        }

        if (price <= 0) {
          return 'Base price per day must be greater than 0'
        }

        if (price > 100000) {
          return 'Base price per day seems unreasonably high'
        }

        return null
      },
    []
  )

  // Validate conditional capacity (required when unlimitedCapacity is false)
  const validateConditionalCapacity = useMemo(
    () =>
      (capacity: number | null, unlimitedCapacity: boolean): string | null => {
        // If unlimited capacity is enabled, capacity is not required
        if (unlimitedCapacity) {
          return null
        }

        // If unlimited capacity is disabled, capacity is required
        if (capacity === null || capacity === undefined) {
          return 'Total capacity is required when unlimited capacity is not enabled'
        }

        if (capacity < 1) {
          return 'Capacity must be at least 1'
        }

        if (capacity > 10000) {
          return 'Capacity seems unreasonably high'
        }

        return null
      },
    []
  )

  // Validate day-of-week pricing
  const validateDayOfWeekPricing = useMemo(
    () =>
      (pricing: DayOfWeekPricing[]): string | null => {
        if (!pricing || pricing.length === 0) return null // Optional

        // Track which days have been used
        const usedDays = new Set<number>()

        for (let i = 0; i < pricing.length; i++) {
          const item = pricing[i]

          // Validate day of week is selected
          if (item.dayOfWeek === null || item.dayOfWeek === undefined) {
            return 'Day of week must be selected'
          }

          // Validate day of week is in valid range (0-6)
          if (item.dayOfWeek < 0 || item.dayOfWeek > 6) {
            return 'Day of week must be between 0 (Sunday) and 6 (Saturday)'
          }

          // Check for duplicate days
          if (usedDays.has(item.dayOfWeek)) {
            return 'Each day can only have one price entry'
          }
          usedDays.add(item.dayOfWeek)

          // Validate price is not empty/null
          if (item.price === null || item.price === undefined) {
            return 'Price is required'
          }

          // Validate price is greater than 0
          if (item.price <= 0) {
            return 'Price must be greater than 0'
          }

          // Validate price is reasonable
          if (item.price > 100000) {
            return 'Price seems unreasonably high'
          }
        }

        return null
      },
    []
  )

  return {
    validateSessionName,
    validateDateRange,
    validatePricing,
    validateCapacity,
    validateBlackoutDates,
    validateFlexibleSession,
    validateFixedSession,
    validateAgeRange,
    validateGenderCapacity,
    validateDaysLimit,
    validateDiscountTiers,
    validateBasePricePerDay,
    validateConditionalCapacity,
    validateDayOfWeekPricing,
  }
}
