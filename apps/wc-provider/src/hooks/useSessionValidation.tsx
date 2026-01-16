'use client'

import { useMemo } from 'react'
import type { BlackoutDate, Duration } from '@/types/sessions'

interface ValidationError {
  field: string
  message: string
}

interface UseSessionValidationReturn {
  validateSessionName: (name: string) => string | null
  validateDateRange: (startDate: string, endDate: string) => string | null
  validateDurations: (durations: Duration[]) => string | null
  validatePricing: (price: number) => string | null
  validateCapacity: (capacity?: number) => string | null
  validateBlackoutDates: (
    blackoutDates: BlackoutDate[],
    sessionStart: string,
    sessionEnd: string
  ) => string | null
  validateFlexibleSession: (data: {
    name: string
    startDate: string
    endDate: string
    durations: Duration[]
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

  // Validate durations (for flexible sessions)
  const validateDurations = useMemo(
    () =>
      (durations: Duration[]): string | null => {
        if (!durations || durations.length === 0) {
          return 'At least one duration option is required'
        }

        for (const duration of durations) {
          if (!duration.weeks || duration.weeks < 1) {
            return 'Duration must be at least 1 week'
          }
          if (duration.weeks > 12) {
            return 'Duration cannot exceed 12 weeks'
          }
          if (!duration.price || duration.price <= 0) {
            return 'Duration price must be greater than 0'
          }
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
      (data: {
        name: string
        startDate: string
        endDate: string
        durations: Duration[]
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

        const durationsError = validateDurations(data.durations)
        if (durationsError) {
          errors.push({ field: 'durations', message: durationsError })
        }

        return errors
      },
    [validateSessionName, validateDateRange, validateDurations]
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

  return {
    validateSessionName,
    validateDateRange,
    validateDurations,
    validatePricing,
    validateCapacity,
    validateBlackoutDates,
    validateFlexibleSession,
    validateFixedSession,
  }
}
