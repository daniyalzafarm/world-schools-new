'use client'

import { useEffect, useState } from 'react'
import { RangeCalendar, Switch } from '@heroui/react'
import { CollapsibleSection, CurrencyInput, Input, RichTextEditor } from '@world-schools/ui-web'
import { type CalendarDate, parseDate } from '@internationalized/date'
import type { RangeValue } from '@react-types/shared'
import type { FixedSession } from '@/types/sessions'
import { useSessionValidation } from '@/hooks/useSessionValidation'
import { formatDateForInput } from '@/utils/sessionFormatters'

interface FixedSessionFormProps {
  session?: FixedSession
  onSubmit: (data: FixedSessionFormData) => void
  onSubmitRef?: { current?: () => void }
}

export interface FixedSessionFormData {
  name: string
  description: string
  sessionStartDate: string
  sessionEndDate: string
  price: number
  capacity?: number
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

const calendarDateToString = (date: CalendarDate): string => {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

/**
 * Fixed Session Form Component
 * Form for creating/editing fixed sessions
 */
export function FixedSessionForm({ session, onSubmit, onSubmitRef }: FixedSessionFormProps) {
  const validation = useSessionValidation()

  // Form state
  const [formData, setFormData] = useState<FixedSessionFormData>({
    name: session?.name || '',
    description: session?.description || '',
    sessionStartDate: session?.sessionStartDate ? formatDateForInput(session.sessionStartDate) : '',
    sessionEndDate: session?.sessionEndDate ? formatDateForInput(session.sessionEndDate) : '',
    price: session?.price ?? 0,
    capacity: session?.capacity,
  })

  // Date range state for RangeCalendar
  const [dateRange, setDateRange] = useState<RangeValue<CalendarDate> | null>(() => {
    const start = stringToCalendarDate(
      session?.sessionStartDate ? formatDateForInput(session.sessionStartDate) : ''
    )
    const end = stringToCalendarDate(
      session?.sessionEndDate ? formatDateForInput(session.sessionEndDate) : ''
    )
    if (start && end) {
      return { start, end }
    }
    return null
  })

  // Capacity toggle
  const [hasCapacityLimit, setHasCapacityLimit] = useState(session?.capacity !== undefined)

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Section-level error tracking
  const [sectionErrors, setSectionErrors] = useState({
    basicInfo: false,
    dates: false,
    pricing: false,
    capacity: false,
  })

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
    const nameError = validation.validateSessionName(formData.name)
    if (nameError) newErrors.name = nameError

    // Validate dates
    const dateError = validation.validateDateRange(
      formData.sessionStartDate,
      formData.sessionEndDate
    )
    if (dateError) newErrors.dates = dateError

    // Validate price
    const priceError = validation.validatePricing(formData.price)
    if (priceError) newErrors.price = priceError

    // Validate capacity if enabled
    if (hasCapacityLimit) {
      const capacityError = validation.validateCapacity(formData.capacity)
      if (capacityError) newErrors.capacity = capacityError
    }

    // Update section-level errors
    setSectionErrors({
      basicInfo: !!newErrors.name,
      dates: !!newErrors.dates,
      pricing: !!newErrors.price,
      capacity: !!newErrors.capacity,
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle submit
  const handleSubmit = () => {
    if (validateForm()) {
      const submitData = {
        ...formData,
        capacity: hasCapacityLimit ? formData.capacity : undefined,
      }
      onSubmit(submitData)
    }
  }

  // Expose submit handler via ref
  useEffect(() => {
    if (onSubmitRef) {
      onSubmitRef.current = handleSubmit
    }
  }, [formData, hasCapacityLimit, onSubmitRef])

  // Update section errors when individual errors change
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      setTimeout(() => {
        setSectionErrors({
          basicInfo: !!errors.name,
          dates: !!errors.dates,
          pricing: !!errors.price,
          capacity: !!errors.capacity,
        })
      }, 0)
    }
  }, [errors])

  // Handle capacity toggle
  const handleCapacityToggle = (enabled: boolean) => {
    setHasCapacityLimit(enabled)
    if (!enabled) {
      setFormData(prev => ({ ...prev, capacity: undefined }))
      setErrors(prev => {
        const { capacity, ...rest } = prev
        return rest
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Section 1: Basic Information */}
      <CollapsibleSection
        title="1. Basic Information"
        defaultOpen={true}
        hasError={sectionErrors.basicInfo}
        errorMessage={sectionErrors.basicInfo ? 'Please fix errors' : undefined}
      >
        <div className="flex flex-col gap-4">
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

          <RichTextEditor
            label="Description"
            placeholder="Describe your session..."
            value={formData.description}
            onChange={value => setFormData(prev => ({ ...prev, description: value }))}
            minHeight="150px"
          />
        </div>
      </CollapsibleSection>

      {/* Section 2: Dates & Availability */}
      <CollapsibleSection
        title="2. Dates & Availability"
        defaultOpen={true}
        hasError={sectionErrors.dates}
        errorMessage={sectionErrors.dates ? 'Please fix errors' : undefined}
      >
        <div className="flex flex-col gap-4">
          {/* Date Range */}
          <div>
            <div className="mb-2">
              <label className="text-base font-semibold text-foreground">
                Session Dates
                <span className="ml-1 text-danger">*</span>
              </label>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Left Column: Individual Date Inputs */}
              <div className="flex gap-4">
                <Input
                  type="date"
                  label="Start Date"
                  labelPlacement="outside"
                  value={formData.sessionStartDate}
                  onValueChange={value => {
                    setFormData(prev => ({ ...prev, sessionStartDate: value }))
                    clearError('dates')
                    // Update RangeCalendar when start date changes
                    const startCal = stringToCalendarDate(value)
                    const endCal = stringToCalendarDate(formData.sessionEndDate)
                    if (startCal && endCal) {
                      setDateRange({ start: startCal, end: endCal })
                    } else if (startCal) {
                      setDateRange(prev => (prev ? { ...prev, start: startCal } : null))
                    }
                  }}
                  isRequired
                  isInvalid={!!errors.dates}
                />
                <Input
                  type="date"
                  label="End Date"
                  labelPlacement="outside"
                  value={formData.sessionEndDate}
                  onValueChange={value => {
                    setFormData(prev => ({ ...prev, sessionEndDate: value }))
                    clearError('dates')
                    // Update RangeCalendar when end date changes
                    const startCal = stringToCalendarDate(formData.sessionStartDate)
                    const endCal = stringToCalendarDate(value)
                    if (startCal && endCal) {
                      setDateRange({ start: startCal, end: endCal })
                    } else if (endCal) {
                      setDateRange(prev => (prev ? { ...prev, end: endCal } : null))
                    }
                  }}
                  isRequired
                  isInvalid={!!errors.dates}
                />
              </div>

              {/* Right Column: RangeCalendar */}
              <div className="flex justify-center">
                <RangeCalendar
                  aria-label="Session date range"
                  value={dateRange}
                  onChange={value => {
                    setDateRange(value)
                    if (value) {
                      setFormData(prev => ({
                        ...prev,
                        sessionStartDate: calendarDateToString(value.start),
                        sessionEndDate: calendarDateToString(value.end),
                      }))
                      clearError('dates')
                    }
                  }}
                  isInvalid={!!errors.dates}
                />
              </div>
            </div>
            {errors.dates && <p className="mt-1.5 text-sm text-danger">{errors.dates}</p>}
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 3: Rates & Pricing */}
      <CollapsibleSection
        title="3. Rates & Pricing"
        defaultOpen={true}
        hasError={sectionErrors.pricing}
        errorMessage={sectionErrors.pricing ? 'Please fix errors' : undefined}
      >
        <div className="flex flex-col gap-4">
          <CurrencyInput
            label="Price"
            labelPlacement="outside"
            placeholder="1200"
            value={formData.price}
            onValueChange={value => {
              setFormData(prev => ({ ...prev, price: value ?? 0 }))
              clearError('price')
            }}
            currency="USD"
            isRequired
            isInvalid={!!errors.price}
            errorMessage={errors.price}
          />
        </div>
      </CollapsibleSection>

      {/* Section 4: Capacity & Availability */}
      <CollapsibleSection
        title="4. Capacity & Availability"
        defaultOpen={true}
        hasError={sectionErrors.capacity}
        errorMessage={sectionErrors.capacity ? 'Please fix errors' : undefined}
      >
        <div className="flex flex-col gap-4">
          {/* Total Capacity */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-base font-semibold text-foreground">Set Capacity Limit</label>
              <p className="text-sm text-default-500">
                Set a maximum number of participants for this session
              </p>
            </div>
            <Switch isSelected={hasCapacityLimit} onValueChange={handleCapacityToggle} />
          </div>

          {hasCapacityLimit && (
            <Input
              type="number"
              label="Maximum Capacity"
              labelPlacement="outside"
              placeholder="50"
              value={formData.capacity?.toString() || ''}
              onValueChange={value =>
                setFormData(prev => ({ ...prev, capacity: parseInt(value) || undefined }))
              }
              min={1}
              isRequired
              isInvalid={!!errors.capacity}
              errorMessage={errors.capacity}
            />
          )}

          {!hasCapacityLimit && (
            <div className="rounded-lg bg-default-100 p-4">
              <p className="text-sm text-default-500">This session will have unlimited capacity</p>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  )
}
