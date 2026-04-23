'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { RangeCalendar } from '@heroui/react'
import { CurrencyInput, DatePicker, Input, TimeInput } from '@world-schools/ui-web'
import {
  type CalendarDate,
  getLocalTimeZone,
  parseDate,
  parseTime,
  Time,
  toCalendarDate,
  today,
} from '@internationalized/date'
import type { DateValue, TimeValue } from '@react-types/datepicker'
import type { RangeValue } from '@react-types/shared'
import type {
  AgeGroupPrice,
  AgeGroupSpots,
  AvailabilityType,
  PricingType,
  Session,
  SessionDayType,
  SessionStatus,
} from '@/types/sessions'
import type { AgeGroup, Camp, CampType } from '@/types/camps'
import type { GlobalDiscount, SessionSpecificDiscount } from '@/types/discounts'
import { formatDateForInput } from '@/utils/sessionFormatters'
import {
  validateDateRange,
  validatePrice,
  validateSessionName,
  validateTotalSpots,
} from '@/utils/sessionValidators'
import { SessionDiscountsCreationSection } from './SessionDiscountsCreationSection'

// Base interface with all shared properties between internal and API types
interface BaseSessionFormData {
  name: string
  startDate: string
  endDate: string
  sessionDayType?: SessionDayType
  pricingType: PricingType
  price?: number
  ageGroupPrices?: AgeGroupPrice[]
  availabilityType: AvailabilityType
  totalSpots?: number
  ageGroupSpots?: AgeGroupSpots[]
  status: SessionStatus
}

// Type for data submitted to API (with string times)
export interface SessionFormData extends BaseSessionFormData {
  arrivalTime?: string
  departureTime?: string
}

// Internal form state type (with Time objects)
interface InternalFormData extends BaseSessionFormData {
  arrivalTime?: TimeValue | null
  departureTime?: TimeValue | null
}

interface SessionFormProps {
  session?: Session
  onSubmit: (data: SessionFormData) => void
  onSubmitRef?: { current?: () => void }
  campType: CampType | null
  camp?: Camp | null
  globalDiscounts?: GlobalDiscount[]
  existingSessions?: Session[]
  // For creation mode
  selectedDiscountIds?: string[]
  onToggleDiscount?: (discountId: string) => void
  sessionSpecificDiscounts?: Omit<SessionSpecificDiscount, 'id'>[]
  onAddSessionDiscount?: (discount: Omit<SessionSpecificDiscount, 'id'>) => void
  onRemoveSessionDiscount?: (index: number) => void
}

// Helper functions to convert between string dates and CalendarDate
const stringToCalendarDate = (dateString: string): CalendarDate | null => {
  if (!dateString) return null
  try {
    return parseDate(dateString)
  } catch {
    return null
  }
}

const calendarDateToString = (date: DateValue): string => {
  const calDate = toCalendarDate(date)
  return `${calDate.year}-${String(calDate.month).padStart(2, '0')}-${String(calDate.day).padStart(2, '0')}`
}

// Helper to convert DateValue to CalendarDate
const toCalDate = (date: DateValue): CalendarDate => {
  return toCalendarDate(date)
}

/**
 * Session Form Component
 * Form for creating/editing sessions
 */
export function SessionForm({
  session,
  onSubmit,
  onSubmitRef,
  campType,
  camp,
  globalDiscounts = [],
  existingSessions = [],
  selectedDiscountIds = [],
  onToggleDiscount,
  sessionSpecificDiscounts = [],
  onAddSessionDiscount,
  onRemoveSessionDiscount,
}: SessionFormProps) {
  // Form state
  const [formData, setFormData] = useState<InternalFormData>({
    name: session?.name || '',
    startDate: session?.startDate ? formatDateForInput(session.startDate) : '',
    endDate: session?.endDate ? formatDateForInput(session.endDate) : '',
    sessionDayType: session?.sessionDayType || undefined,
    arrivalTime: session?.arrivalTime ? parseTime(session.arrivalTime) : new Time(9, 0),
    departureTime: session?.departureTime ? parseTime(session.departureTime) : new Time(13, 0),
    pricingType: session?.pricingType || 'single',
    price: session?.price ?? 0,
    ageGroupPrices: session?.ageGroupPrices ?? [],
    availabilityType: session?.availabilityType || 'single',
    totalSpots: session?.totalSpots,
    ageGroupSpots: session?.ageGroupSpots ?? [],
    status: session?.status || 'draft',
  })

  // Date range state for RangeCalendar
  const [dateRange, setDateRange] = useState<RangeValue<CalendarDate> | null>(() => {
    const start = stringToCalendarDate(
      session?.startDate ? formatDateForInput(session.startDate) : ''
    )
    const end = stringToCalendarDate(session?.endDate ? formatDateForInput(session.endDate) : '')
    if (start && end) {
      return { start, end }
    }
    return null
  })

  // Disabled ranges from other sessions of the same camp
  const disabledRanges = useMemo<Array<[CalendarDate, CalendarDate]>>(() => {
    return existingSessions
      .filter(s => s.id !== session?.id)
      .map(s => {
        const start = stringToCalendarDate(formatDateForInput(s.startDate))
        const end = stringToCalendarDate(formatDateForInput(s.endDate))
        return start && end ? ([start, end] as [CalendarDate, CalendarDate]) : null
      })
      .filter((r): r is [CalendarDate, CalendarDate] => r !== null)
  }, [existingSessions, session?.id])

  const isDateUnavailable = (date: DateValue) =>
    disabledRanges.some(([from, to]) => date.compare(from) >= 0 && date.compare(to) <= 0)

  const rangeOverlapsDisabled = (start: CalendarDate, end: CalendarDate) =>
    disabledRanges.some(([from, to]) => end.compare(from) >= 0 && start.compare(to) <= 0)

  // Half-day toggle state
  const [isHalfDay, setIsHalfDay] = useState(session?.sessionDayType === 'half_day')

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Clear specific error
  const clearError = (field: string) => {
    setErrors(prev => {
      const { [field]: _, ...rest } = prev
      return rest
    })
  }

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Validate name
    if (!validateSessionName(formData.name)) {
      newErrors.name = 'Session name must be between 3 and 100 characters'
    }

    // Validate dates
    if (!validateDateRange(formData.startDate, formData.endDate)) {
      newErrors.dates = 'End date must be after start date'
    } else {
      const startCal = stringToCalendarDate(formData.startDate)
      const endCal = stringToCalendarDate(formData.endDate)
      if (startCal && endCal && rangeOverlapsDisabled(startCal, endCal)) {
        newErrors.dates = 'Selected date range overlaps an existing session.'
      }
    }

    // Validate half-day times if applicable
    if (isHalfDay) {
      if (!formData.arrivalTime || !formData.departureTime) {
        newErrors.times = 'Both arrival and departure times are required for half-day sessions'
      } else {
        // Validate departure is after arrival using Time object comparison
        const arrivalMinutes = formData.arrivalTime.hour * 60 + formData.arrivalTime.minute
        const departureMinutes = formData.departureTime.hour * 60 + formData.departureTime.minute

        if (departureMinutes <= arrivalMinutes) {
          newErrors.times = 'Departure time must be after arrival time'
        }
      }
    }

    // Validate price (only for single pricing)
    if (formData.pricingType === 'single') {
      if (formData.price === undefined || !validatePrice(formData.price)) {
        newErrors.price = 'Price must be between 0 and 1,000,000'
      }
    }

    // Validate age group pricing
    if (formData.pricingType === 'age_group') {
      if (!formData.ageGroupPrices || formData.ageGroupPrices.length === 0) {
        newErrors.ageGroupPrices = 'Please set prices for all age groups'
      } else if (camp?.ageGroups) {
        // Check that all age groups have prices
        const missingPrices = camp.ageGroups.some(ageGroup => {
          const ageGroupId = `${ageGroup.min}-${ageGroup.max}`
          return !formData.ageGroupPrices?.find(agp => agp.ageGroupId === ageGroupId)
        })
        if (missingPrices) {
          newErrors.ageGroupPrices = 'Please set prices for all age groups'
        }
        // Validate each price
        const invalidPrices = formData.ageGroupPrices.some(agp => !validatePrice(agp.price))
        if (invalidPrices) {
          newErrors.ageGroupPrices = 'All prices must be between 0 and 1,000,000'
        }
      }
    }

    // Validate capacity (always required)
    if (formData.availabilityType === 'single') {
      if (!validateTotalSpots(formData.totalSpots)) {
        newErrors.capacity = 'Total spots must be between 1 and 10,000'
      }
    }

    // Validate age group availability
    if (formData.availabilityType === 'age_group') {
      if (!formData.ageGroupSpots || formData.ageGroupSpots.length === 0) {
        newErrors.ageGroupSpots = 'Please set availability for all age groups'
      } else if (camp?.ageGroups) {
        // Check that all age groups have spots
        const missingSpots = camp.ageGroups.some(ageGroup => {
          const ageGroupId = `${ageGroup.min}-${ageGroup.max}`
          return !formData.ageGroupSpots?.find(ags => ags.ageGroupId === ageGroupId)
        })
        if (missingSpots) {
          newErrors.ageGroupSpots = 'Please set availability for all age groups'
        }
        // Validate each spot value
        const invalidSpots = formData.ageGroupSpots.some(ags => !validateTotalSpots(ags.spots))
        if (invalidSpots) {
          newErrors.ageGroupSpots = 'All spot values must be between 1 and 10,000'
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Helper function to convert Time object to string (HH:MM)
  const timeToString = (time: TimeValue | null | undefined): string | undefined => {
    if (!time) return undefined
    return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`
  }

  // Handle submit
  const handleSubmit = () => {
    if (validateForm()) {
      const submitData: SessionFormData = {
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
        pricingType: formData.pricingType,
        price: formData.pricingType === 'single' ? formData.price : undefined,
        ageGroupPrices: formData.pricingType === 'age_group' ? formData.ageGroupPrices : undefined,
        availabilityType: formData.availabilityType,
        totalSpots: formData.availabilityType === 'single' ? formData.totalSpots : undefined,
        ageGroupSpots:
          formData.availabilityType === 'age_group' ? formData.ageGroupSpots : undefined,
        status: formData.status,
        sessionDayType: isHalfDay ? 'half_day' : undefined,
        arrivalTime: isHalfDay ? timeToString(formData.arrivalTime) : undefined,
        departureTime: isHalfDay ? timeToString(formData.departureTime) : undefined,
      }
      onSubmit(submitData)
    }
  }

  // Expose submit handler via ref
  useEffect(() => {
    if (onSubmitRef) {
      onSubmitRef.current = handleSubmit
    }
  }, [formData, isHalfDay, onSubmitRef])

  // Handle half-day toggle
  const handleHalfDayToggle = () => {
    setIsHalfDay(!isHalfDay)
    // Clear time errors when toggling
    setErrors(prev => {
      const { times, arrivalTime, departureTime, ...rest } = prev
      return rest
    })
  }

  // Handle age group pricing toggle
  const handleAgeGroupPricingToggle = () => {
    if (formData.pricingType === 'single') {
      // Switch to age group pricing
      setFormData(prev => ({
        ...prev,
        pricingType: 'age_group',
        ageGroupPrices:
          camp?.ageGroups.map(ageGroup => ({
            ageGroupId: `${ageGroup.min}-${ageGroup.max}`,
            price: prev.price ?? 0,
          })) ?? [],
      }))
    } else {
      // Switch back to single pricing
      const avgPrice =
        formData.ageGroupPrices && formData.ageGroupPrices.length > 0
          ? Math.round(
              formData.ageGroupPrices.reduce((sum, agp) => sum + agp.price, 0) /
                formData.ageGroupPrices.length
            )
          : 0
      setFormData(prev => ({
        ...prev,
        pricingType: 'single',
        price: avgPrice,
      }))
    }
    setErrors(prev => {
      const { price, ageGroupPrices, ...rest } = prev
      return rest
    })
  }

  // Handle age group availability toggle
  const handleAgeGroupAvailabilityToggle = () => {
    if (formData.availabilityType === 'single') {
      // Switch to age group availability
      setFormData(prev => ({
        ...prev,
        availabilityType: 'age_group',
        ageGroupSpots:
          camp?.ageGroups.map(ageGroup => ({
            ageGroupId: `${ageGroup.min}-${ageGroup.max}`,
            spots: prev.totalSpots ?? 0,
          })) ?? [],
      }))
    } else {
      // Switch back to single availability
      const totalSpots =
        formData.ageGroupSpots && formData.ageGroupSpots.length > 0
          ? formData.ageGroupSpots.reduce((sum, ags) => sum + ags.spots, 0)
          : 0
      setFormData(prev => ({
        ...prev,
        availabilityType: 'single',
        totalSpots,
      }))
    }
    setErrors(prev => {
      const { capacity, ageGroupSpots, ...rest } = prev
      return rest
    })
  }

  return (
    <div className="flex flex-col">
      {/* Section 1: Session details */}
      <div className="bg-background py-10 border-b border-default-200 last:border-b-0">
        <div className="mb-6">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-secondary text-base font-semibold mr-3">
            1
          </span>
          <h2 className="inline text-lg font-semibold text-default-900">Session details</h2>
        </div>
        <div className="flex flex-col gap-6">
          <Input
            type="text"
            label="Session Name"
            labelPlacement="outside"
            placeholder="e.g., Week 1 - Summer Camp"
            value={formData.name}
            onValueChange={value => {
              setFormData(prev => ({ ...prev, name: value }))
              clearError('name')
            }}
            isRequired
            isInvalid={!!errors.name}
            errorMessage={errors.name}
          />
          {/* Date Range */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Left Column: Individual Date Inputs */}
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex gap-4">
                  <DatePicker
                    label="Start Date"
                    labelPlacement="outside"
                    value={stringToCalendarDate(formData.startDate) as any}
                    minValue={today(getLocalTimeZone()).add({ days: 1 })}
                    isDateUnavailable={isDateUnavailable}
                    onChange={value => {
                      const dateString = value ? calendarDateToString(value) : ''
                      setFormData(prev => ({ ...prev, startDate: dateString }))
                      clearError('dates')
                      // Update RangeCalendar when start date changes
                      const endCal = stringToCalendarDate(formData.endDate)
                      if (value && endCal) {
                        const startCal = toCalDate(value)
                        setDateRange({ start: startCal, end: endCal })
                      } else if (value) {
                        const startCal = toCalDate(value)
                        setDateRange(prev => (prev ? { ...prev, start: startCal } : null))
                      }
                    }}
                    isRequired
                    isInvalid={!!errors.dates}
                  />
                  <DatePicker
                    label="End Date"
                    labelPlacement="outside"
                    value={stringToCalendarDate(formData.endDate) as any}
                    minValue={today(getLocalTimeZone()).add({ days: 1 })}
                    isDateUnavailable={isDateUnavailable}
                    onChange={value => {
                      const dateString = value ? calendarDateToString(value) : ''
                      setFormData(prev => ({ ...prev, endDate: dateString }))
                      clearError('dates')
                      // Update RangeCalendar when end date changes
                      const startCal = stringToCalendarDate(formData.startDate)
                      if (startCal && value) {
                        const endCal = toCalDate(value)
                        setDateRange({ start: startCal, end: endCal })
                      } else if (value) {
                        const endCal = toCalDate(value)
                        setDateRange(prev => (prev ? { ...prev, end: endCal } : null))
                      }
                    }}
                    isRequired
                    isInvalid={!!errors.dates}
                  />
                </div>
                {errors.dates && <p className="mt-1.5 text-sm text-danger">{errors.dates}</p>}
              </div>
              {/* Half-Day Session Toggle (only for day camps) */}
              {campType === 'day' && (
                <div className="mt-2">
                  {!isHalfDay ? (
                    <button
                      type="button"
                      onClick={handleHalfDayToggle}
                      className="cursor-pointer underline text-sm font-semibold text-default-500 hover:text-default-600 transition-colors"
                    >
                      + Set as half-day session
                    </button>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {/* Time Inputs */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <TimeInput
                          label="Arrival time"
                          labelPlacement="outside"
                          description="When children arrive at camp"
                          value={formData.arrivalTime}
                          onChange={value => {
                            setFormData(prev => ({ ...prev, arrivalTime: value }))
                            clearError('arrivalTime')
                            clearError('times')
                          }}
                          isRequired
                          isInvalid={!!errors.arrivalTime || !!errors.times}
                          errorMessage={errors.arrivalTime}
                        />
                        <TimeInput
                          label="Departure time"
                          labelPlacement="outside"
                          description="When children are picked up"
                          value={formData.departureTime}
                          onChange={value => {
                            setFormData(prev => ({ ...prev, departureTime: value }))
                            clearError('departureTime')
                            clearError('times')
                          }}
                          isRequired
                          isInvalid={!!errors.departureTime || !!errors.times}
                          errorMessage={errors.departureTime}
                        />
                      </div>
                      {errors.times && <p className="text-sm text-danger">{errors.times}</p>}

                      {/* Back to Full Day Link */}
                      <button
                        type="button"
                        onClick={handleHalfDayToggle}
                        className="max-w-fit cursor-pointer underline text-sm font-semibold text-default-500 hover:text-default-600 transition-colors"
                      >
                        ← Full day
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: RangeCalendar */}
            <div className="flex justify-center">
              <RangeCalendar
                aria-label="Session date range"
                value={dateRange as any}
                onChange={value => {
                  setDateRange(value)
                  if (value) {
                    setFormData(prev => ({
                      ...prev,
                      startDate: calendarDateToString(value.start),
                      endDate: calendarDateToString(value.end),
                    }))
                    clearError('dates')
                  }
                }}
                isInvalid={!!errors.dates}
                minValue={today(getLocalTimeZone()).add({ days: 1 })}
                isDateUnavailable={isDateUnavailable}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Pricing */}
      <div className="bg-background py-10 border-b border-default-200 last:border-b-0">
        <div className="mb-6">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-secondary text-base font-semibold mr-2">
            2
          </span>
          <h2 className="inline text-lg font-semibold text-default-900">Pricing</h2>
        </div>
        <div className="flex flex-col gap-4">
          {/* Single Price Input */}
          {formData.pricingType === 'single' && (
            <>
              <CurrencyInput
                label="Price"
                labelPlacement="outside"
                placeholder="1200"
                value={formData.price ?? 0}
                onValueChange={value => {
                  setFormData(prev => ({ ...prev, price: value ?? 0 }))
                  clearError('price')
                }}
                currency="USD"
                isRequired
                isInvalid={!!errors.price}
                errorMessage={errors.price}
              />
              {/* Toggle to age group pricing (only if camp has 2+ age groups) */}
              {camp?.ageGroups && camp.ageGroups.length >= 2 && (
                <button
                  type="button"
                  onClick={handleAgeGroupPricingToggle}
                  className="cursor-pointer underline text-sm font-semibold text-default-500 hover:text-default-600 transition-colors self-start"
                >
                  + Set different prices per age group
                </button>
              )}
              {/* Informational note when camp has only 1 age group */}
              {camp?.ageGroups?.length === 1 && (
                <p className="text-sm text-default-500">
                  Add more age groups in{' '}
                  <Link
                    href={`/camps/${camp.id}/edit/audience`}
                    className="text-primary-700 underline hover:text-primary-600 transition-colors"
                  >
                    audience settings
                  </Link>{' '}
                  to enable age group pricing.
                </p>
              )}
            </>
          )}

          {/* Age Group Prices */}
          {formData.pricingType === 'age_group' && camp?.ageGroups && (
            <>
              <div className="flex flex-col gap-3">
                {camp.ageGroups.map(ageGroup => {
                  const ageGroupId = `${ageGroup.min}-${ageGroup.max}`
                  const ageGroupPrice = formData.ageGroupPrices?.find(
                    agp => agp.ageGroupId === ageGroupId
                  )
                  return (
                    <div key={ageGroupId} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-default-700 min-w-24">
                        Ages {ageGroup.min}-{ageGroup.max}
                      </span>
                      <CurrencyInput
                        labelPlacement="outside"
                        placeholder="1200"
                        value={ageGroupPrice?.price ?? 0}
                        onValueChange={value => {
                          setFormData(prev => {
                            const existingPrices = prev.ageGroupPrices ?? []
                            const updatedPrices = existingPrices.filter(
                              agp => agp.ageGroupId !== ageGroupId
                            )
                            updatedPrices.push({
                              ageGroupId,
                              price: value ?? 0,
                            })
                            return { ...prev, ageGroupPrices: updatedPrices }
                          })
                          clearError('ageGroupPrices')
                        }}
                        currency="USD"
                        isRequired
                        isInvalid={!!errors.ageGroupPrices}
                      />
                    </div>
                  )
                })}
              </div>
              {errors.ageGroupPrices && (
                <p className="text-sm text-danger">{errors.ageGroupPrices}</p>
              )}
              {/* Back to single price link */}
              <button
                type="button"
                onClick={handleAgeGroupPricingToggle}
                className="cursor-pointer underline text-sm font-semibold text-default-500 hover:text-default-600 transition-colors self-start"
              >
                ← Single price
              </button>
            </>
          )}
        </div>
      </div>

      {/* Section 3: Availability */}
      <div className="bg-background py-10 border-b border-default-200 last:border-b-0">
        <div className="mb-6">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-secondary text-base font-semibold mr-3">
            3
          </span>
          <h2 className="inline text-lg font-semibold text-default-900">Availability</h2>
        </div>
        <div className="flex flex-col gap-4">
          {/* Single Capacity Input */}
          {formData.availabilityType === 'single' && (
            <>
              <Input
                type="number"
                label="Spots Available"
                labelPlacement="outside"
                placeholder="50"
                value={formData.totalSpots?.toString() || ''}
                onValueChange={value => {
                  setFormData(prev => ({ ...prev, totalSpots: parseInt(value) || undefined }))
                  clearError('capacity')
                }}
                min={1}
                isRequired
                isInvalid={!!errors.capacity}
                errorMessage={errors.capacity}
              />
              {/* Toggle to age group availability (only if camp has 2+ age groups) */}
              {camp?.ageGroups && camp.ageGroups.length >= 2 && (
                <button
                  type="button"
                  onClick={handleAgeGroupAvailabilityToggle}
                  className="cursor-pointer underline text-sm font-semibold text-default-500 hover:text-default-600 transition-colors self-start"
                >
                  + Set different availability per age group
                </button>
              )}
              {/* Informational note when camp has only 1 age group */}
              {camp?.ageGroups?.length === 1 && (
                <p className="text-sm text-default-500">
                  Add more age groups in{' '}
                  <Link
                    href={`/camps/${camp.id}/edit/audience`}
                    className="text-primary-700 underline hover:text-primary-600 transition-colors"
                  >
                    audience settings
                  </Link>{' '}
                  to enable age group availability.
                </p>
              )}
            </>
          )}

          {/* Age Group Availability */}
          {formData.availabilityType === 'age_group' && camp?.ageGroups && (
            <>
              <div className="flex flex-col gap-3">
                {camp.ageGroups.map(ageGroup => {
                  const ageGroupId = `${ageGroup.min}-${ageGroup.max}`
                  const ageGroupSpot = formData.ageGroupSpots?.find(
                    ags => ags.ageGroupId === ageGroupId
                  )
                  return (
                    <div key={ageGroupId} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-default-700 min-w-24">
                        Ages {ageGroup.min}-{ageGroup.max}
                      </span>
                      <Input
                        type="number"
                        labelPlacement="outside"
                        placeholder="50"
                        value={ageGroupSpot?.spots?.toString() || ''}
                        onValueChange={value => {
                          setFormData(prev => {
                            const existingSpots = prev.ageGroupSpots ?? []
                            const updatedSpots = existingSpots.filter(
                              ags => ags.ageGroupId !== ageGroupId
                            )
                            updatedSpots.push({
                              ageGroupId,
                              spots: parseInt(value) || 0,
                            })
                            return { ...prev, ageGroupSpots: updatedSpots }
                          })
                          clearError('ageGroupSpots')
                        }}
                        min={1}
                        isRequired
                        isInvalid={!!errors.ageGroupSpots}
                      />
                    </div>
                  )
                })}
              </div>
              {errors.ageGroupSpots && (
                <p className="text-sm text-danger">{errors.ageGroupSpots}</p>
              )}
              {/* Back to single availability link */}
              <button
                type="button"
                onClick={handleAgeGroupAvailabilityToggle}
                className="cursor-pointer underline text-sm font-semibold text-default-500 hover:text-default-600 transition-colors self-start"
              >
                ← Single number
              </button>
            </>
          )}
        </div>
      </div>

      {/* Section 4: Discounts */}
      {camp && onToggleDiscount && onAddSessionDiscount && onRemoveSessionDiscount && (
        <div className="bg-background py-10 border-b border-default-200 last:border-b-0">
          <div className="mb-6">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-secondary text-base font-semibold mr-3">
              4
            </span>
            <h2 className="inline text-lg font-semibold text-default-900">Discounts</h2>
          </div>
          <SessionDiscountsCreationSection
            pricingType={formData.pricingType}
            camp={camp}
            globalDiscounts={globalDiscounts}
            selectedGlobalDiscountIds={selectedDiscountIds}
            onToggleGlobalDiscount={onToggleDiscount}
            sessionSpecificDiscounts={sessionSpecificDiscounts}
            onAddSessionDiscount={onAddSessionDiscount}
            onRemoveSessionDiscount={onRemoveSessionDiscount}
          />
        </div>
      )}
    </div>
  )
}
