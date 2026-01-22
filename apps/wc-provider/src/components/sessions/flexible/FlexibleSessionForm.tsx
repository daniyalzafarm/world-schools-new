'use client'

import { useEffect, useState } from 'react'
import { Button, RangeCalendar, Switch } from '@heroui/react'
import {
  CollapsibleSection,
  CurrencyInput,
  DatePicker,
  DayOfWeekSelector,
  Input,
  RichTextEditor,
  SelectField,
} from '@world-schools/ui-web'
import { type CalendarDate, parseDate } from '@internationalized/date'
import type { RangeValue } from '@react-types/shared'
import { Plus, Trash2 } from 'lucide-react'
import type {
  AgeRange,
  BlackoutDate,
  DayOfWeekPricing,
  DiscountTier,
  FlexibleSession,
} from '@/types/sessions'
import type { Gender } from '@/types/camps'
import { useSessionValidation } from '@/hooks/useSessionValidation'
import { formatDateForInput } from '@/utils/sessionFormatters'

interface FlexibleSessionFormProps {
  session?: FlexibleSession
  onSubmit: (data: FlexibleSessionFormData) => void
  onSubmitRef?: { current?: () => void }
  campGender: Gender
}

export interface FlexibleSessionFormData {
  name: string
  description: string
  startDate: string
  endDate: string
  blackoutDates: BlackoutDate[]
  basePricePerDay: number | null
  requireConsecutiveDays: boolean
  minDaysLimit: number | null
  maxDaysLimit: number | null
  availableDaysOfWeek: number[]
  specificStartDays: number[]
  discountTiers: DiscountTier[]
  dayOfWeekPricing: DayOfWeekPricing[]
  ageRange: AgeRange | null
  capacity: number | null
  unlimitedCapacity: boolean
  boysCapacity: number | null
  girlsCapacity: number | null
  separateGenderCapacity: boolean
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
 * Flexible Session Form Component
 * Form for creating/editing flexible sessions
 * Reference: Design flex-session-3.2.png
 */
export function FlexibleSessionForm({
  session,
  onSubmit,
  onSubmitRef,
  campGender,
}: FlexibleSessionFormProps) {
  const validation = useSessionValidation()

  // Form state
  const [formData, setFormData] = useState<FlexibleSessionFormData>({
    name: session?.name || '',
    description: session?.description || '',
    startDate: session?.startDate ? formatDateForInput(session.startDate) : '',
    endDate: session?.endDate ? formatDateForInput(session.endDate) : '',
    blackoutDates: session?.blackoutDates ?? [],
    basePricePerDay: session?.basePricePerDay ?? null,
    requireConsecutiveDays: session?.requireConsecutiveDays ?? false,
    minDaysLimit: session?.minDaysLimit ?? null,
    maxDaysLimit: session?.maxDaysLimit ?? null,
    availableDaysOfWeek: session?.availableDaysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
    specificStartDays: session?.specificStartDays ?? [0, 1, 2, 3, 4, 5, 6],
    discountTiers: session?.discountTiers ?? [],
    dayOfWeekPricing: session?.dayOfWeekPricing ?? [],
    ageRange: session?.ageRange ?? null,
    capacity: session?.capacity ?? null,
    unlimitedCapacity: session?.unlimitedCapacity ?? false,
    boysCapacity: session?.boysCapacity ?? null,
    girlsCapacity: session?.girlsCapacity ?? null,
    separateGenderCapacity: session?.separateGenderCapacity ?? false,
  })

  // Date range state for RangeCalendar
  const [dateRange, setDateRange] = useState<RangeValue<CalendarDate> | null>(() => {
    const start = stringToCalendarDate(formData.startDate)
    const end = stringToCalendarDate(formData.endDate)
    if (start && end) {
      return { start, end }
    }
    return null
  })

  // Days limit toggle state
  const [showDaysLimit, setShowDaysLimit] = useState<boolean>(
    () => formData.minDaysLimit !== null || formData.maxDaysLimit !== null
  )

  // Validation errors - organized by section
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Section error states
  const [sectionErrors, setSectionErrors] = useState({
    basicInfo: false,
    dates: false,
    pricing: false,
    capacity: false,
  })

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Section 1: Basic Information
    const nameError = validation.validateSessionName(formData.name)
    if (nameError) newErrors.name = nameError

    // Section 2: Dates & Availability
    const dateError = validation.validateDateRange(formData.startDate, formData.endDate)
    if (dateError) newErrors.dates = dateError

    // Validate blackout dates
    if (formData.blackoutDates.length > 0) {
      const blackoutError = validation.validateBlackoutDates(
        formData.blackoutDates,
        formData.startDate,
        formData.endDate
      )
      if (blackoutError) newErrors.blackoutDates = blackoutError
    }

    // Section 3: Pricing
    // Base price per day is now REQUIRED
    const basePriceError = validation.validateBasePricePerDay(formData.basePricePerDay, true)
    if (basePriceError) newErrors.basePricePerDay = basePriceError

    const daysLimitError = validation.validateDaysLimit(
      formData.minDaysLimit,
      formData.maxDaysLimit
    )
    if (daysLimitError) newErrors.daysLimit = daysLimitError

    const discountTiersError = validation.validateDiscountTiers(formData.discountTiers)
    if (discountTiersError) newErrors.discountTiers = discountTiersError

    // Validate day-of-week pricing
    const dayOfWeekPricingError = validation.validateDayOfWeekPricing(formData.dayOfWeekPricing)
    if (dayOfWeekPricingError) newErrors.dayOfWeekPricing = dayOfWeekPricingError

    // Section 4: Capacity & Availability
    // Use conditional capacity validation (required when unlimitedCapacity is false)
    const capacityError = validation.validateConditionalCapacity(
      formData.capacity,
      formData.unlimitedCapacity
    )
    if (capacityError) newErrors.capacity = capacityError

    const ageRangeError = validation.validateAgeRange(formData.ageRange)
    if (ageRangeError) newErrors.ageRange = ageRangeError

    const genderCapacityError = validation.validateGenderCapacity(
      formData.boysCapacity,
      formData.girlsCapacity,
      formData.capacity,
      formData.separateGenderCapacity
    )
    if (genderCapacityError) newErrors.genderCapacity = genderCapacityError

    // Update section error states
    setSectionErrors({
      basicInfo: !!newErrors.name,
      dates: !!(newErrors.dates || newErrors.blackoutDates),
      pricing: !!(
        newErrors.basePricePerDay ||
        newErrors.daysLimit ||
        newErrors.discountTiers ||
        newErrors.dayOfWeekPricing
      ),
      capacity: !!(newErrors.capacity || newErrors.ageRange || newErrors.genderCapacity),
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Clear specific field error when user fixes it
  const clearError = (field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })

    // Update section errors
    setTimeout(() => {
      setSectionErrors({
        basicInfo: !!errors.name,
        dates: !!(errors.dates || errors.blackoutDates),
        pricing: !!(errors.basePricePerDay || errors.daysLimit || errors.discountTiers),
        capacity: !!(errors.capacity || errors.ageRange || errors.genderCapacity),
      })
    }, 0)
  }

  // Handle submit
  const handleSubmit = () => {
    if (validateForm()) {
      // Prepare submission data, respecting toggle states
      const submissionData: FlexibleSessionFormData = {
        ...formData,
        // Only include min/max days limit if toggle is ON
        minDaysLimit: showDaysLimit ? formData.minDaysLimit : null,
        maxDaysLimit: showDaysLimit ? formData.maxDaysLimit : null,
      }
      onSubmit(submissionData)
    }
  }

  // Expose submit handler via ref
  useEffect(() => {
    if (onSubmitRef) {
      onSubmitRef.current = handleSubmit
    }
  }, [formData, showDaysLimit, onSubmitRef])

  // Add blackout date
  const addBlackoutDate = () => {
    setFormData(prev => ({
      ...prev,
      blackoutDates: [...prev.blackoutDates, { start: '', end: '' }],
    }))
  }

  // Remove blackout date
  const removeBlackoutDate = (index: number) => {
    setFormData(prev => ({
      ...prev,
      blackoutDates: prev.blackoutDates.filter((_, i) => i !== index),
    }))
    // Clear blackout dates error when item is removed
    clearError('blackoutDates')
  }

  // Update blackout date
  const updateBlackoutDate = (index: number, field: keyof BlackoutDate, value: string) => {
    setFormData(prev => ({
      ...prev,
      blackoutDates: prev.blackoutDates.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    }))
  }

  // Add discount tier
  const addDiscountTier = () => {
    setFormData(prev => ({
      ...prev,
      discountTiers: [...prev.discountTiers, { minDays: 1, discountPercent: 0 }],
    }))
  }

  // Remove discount tier
  const removeDiscountTier = (index: number) => {
    setFormData(prev => ({
      ...prev,
      discountTiers: prev.discountTiers.filter((_, i) => i !== index),
    }))
    // Clear discount tiers error when item is removed
    clearError('discountTiers')
  }

  // Update discount tier
  const updateDiscountTier = (
    index: number,
    field: keyof DiscountTier,
    value: number | undefined
  ) => {
    setFormData(prev => ({
      ...prev,
      discountTiers: prev.discountTiers.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    }))
  }

  // Add day-of-week pricing
  const addDayOfWeekPricing = () => {
    setFormData(prev => ({
      ...prev,
      dayOfWeekPricing: [...prev.dayOfWeekPricing, { dayOfWeek: 0, price: 0 }],
    }))
  }

  // Remove day-of-week pricing
  const removeDayOfWeekPricing = (index: number) => {
    setFormData(prev => ({
      ...prev,
      dayOfWeekPricing: prev.dayOfWeekPricing.filter((_, i) => i !== index),
    }))
    // Clear day-of-week pricing error when item is removed
    clearError('dayOfWeekPricing')
  }

  // Update day-of-week pricing
  const updateDayOfWeekPricing = (index: number, field: keyof DayOfWeekPricing, value: number) => {
    setFormData(prev => ({
      ...prev,
      dayOfWeekPricing: prev.dayOfWeekPricing.map((d, i) =>
        i === index ? { ...d, [field]: value } : d
      ),
    }))
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
            label="Session Title"
            labelPlacement="outside"
            placeholder="e.g., Summer 2024 Language Immersion"
            value={formData.name}
            onValueChange={value => {
              setFormData(prev => ({ ...prev, name: value }))
              clearError('name')
            }}
            isRequired
            isInvalid={!!errors.name}
            errorMessage={errors.name}
          />

          {/* <RichTextEditor
            label="Description"
            placeholder="Describe your session..."
            value={formData.description}
            onChange={value => setFormData(prev => ({ ...prev, description: value }))}
            minHeight="150px"
          /> */}
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
                Date Range
                <span className="ml-1 text-danger">*</span>
              </label>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Left Column: Individual Date Inputs */}
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <Input
                    type="date"
                    label="Start Date"
                    labelPlacement="outside"
                    value={formData.startDate}
                    onValueChange={value => {
                      setFormData(prev => ({ ...prev, startDate: value }))
                      clearError('dates')
                      // Update RangeCalendar when start date changes
                      const startCal = stringToCalendarDate(value)
                      const endCal = stringToCalendarDate(formData.endDate)
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
                    value={formData.endDate}
                    onValueChange={value => {
                      setFormData(prev => ({ ...prev, endDate: value }))
                      clearError('dates')
                      // Update RangeCalendar when end date changes
                      const startCal = stringToCalendarDate(formData.startDate)
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
                {/* Available Days of Week */}
                <DayOfWeekSelector
                  label="Available Days of Week"
                  value={formData.availableDaysOfWeek}
                  onChange={value => setFormData(prev => ({ ...prev, availableDaysOfWeek: value }))}
                />

                {/* Specific Start Days */}
                <DayOfWeekSelector
                  label="Specific Start Days (which days sessions can begin)"
                  value={formData.specificStartDays}
                  onChange={value => setFormData(prev => ({ ...prev, specificStartDays: value }))}
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
                        startDate: calendarDateToString(value.start),
                        endDate: calendarDateToString(value.end),
                      }))
                    }
                  }}
                  isInvalid={!!errors.dates}
                  errorMessage={errors.dates}
                  showHelper={!!errors.dates}
                  // classNames={{
                  //   base: 'w-full max-w-full',
                  // }}
                />
              </div>
            </div>
            {errors.dates && <p className="mt-1.5 text-sm text-danger">{errors.dates}</p>}
          </div>

          <div className="flex gap-4">
            {/* Require Consecutive Days */}
            <div className="flex w-full items-center justify-between">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Require Consecutive Days
                </label>
                <p className="text-sm text-default-500">
                  Sessions must be booked for consecutive days
                </p>
              </div>
              <Switch
                isSelected={formData.requireConsecutiveDays}
                onValueChange={value =>
                  setFormData(prev => ({ ...prev, requireConsecutiveDays: value }))
                }
              />
            </div>
            <div className="flex w-full items-center justify-between"></div>
          </div>

          {/* Blackout Dates */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-base font-semibold text-foreground">
                Blackout Dates (Optional)
              </label>
              <Button
                size="sm"
                color="default"
                variant="flat"
                startContent={<Plus className="w-4 h-4" />}
                onPress={addBlackoutDate}
              >
                Add Blackout
              </Button>
            </div>
            <p className="mb-4 text-sm leading-normal text-default-500">
              Block specific date ranges when the camp is closed
            </p>

            {errors.blackoutDates && (
              <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 p-3 dark:border-danger-800 dark:bg-danger-950">
                <p className="text-sm text-danger-700 dark:text-danger-300">
                  {errors.blackoutDates}
                </p>
              </div>
            )}

            {formData.blackoutDates.length > 0 && (
              <div className="flex flex-col gap-4">
                {formData.blackoutDates.map((blackout, index) => (
                  <div key={index} className="flex items-end gap-3">
                    <DatePicker
                      label="Start Date"
                      labelPlacement="outside"
                      value={stringToCalendarDate(blackout.start)}
                      onChange={value => {
                        const dateString = value ? value.toString() : ''
                        updateBlackoutDate(index, 'start', dateString)
                      }}
                      className="flex-1"
                    />
                    <DatePicker
                      label="End Date"
                      labelPlacement="outside"
                      value={stringToCalendarDate(blackout.end)}
                      onChange={value => {
                        const dateString = value ? value.toString() : ''
                        updateBlackoutDate(index, 'end', dateString)
                      }}
                      className="flex-1"
                    />
                    <Button
                      isIconOnly
                      color="danger"
                      variant="flat"
                      onPress={() => removeBlackoutDate(index)}
                      className="mb-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {formData.blackoutDates.length === 0 && (
              <div className="py-6 text-center text-sm text-default-400">
                No blackout dates added
              </div>
            )}
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
          <div className="flex gap-4">
            {/* Base Price per Day */}
            <CurrencyInput
              label="Base Price per Day"
              labelPlacement="outside"
              placeholder="50"
              value={formData.basePricePerDay}
              onValueChange={value => {
                setFormData(prev => ({ ...prev, basePricePerDay: value }))
                clearError('basePricePerDay')
              }}
              currency="USD"
              isRequired
              isInvalid={!!errors.basePricePerDay}
              errorMessage={errors.basePricePerDay}
            />

            <div className="flex w-full items-center justify-between">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Set minimum/maximum days limit
                </label>
                <p className="text-sm text-default-500">
                  Restrict the number of days participants can book
                </p>
              </div>
              <Switch
                isSelected={showDaysLimit}
                onValueChange={value => {
                  setShowDaysLimit(value)
                  // Clear values when toggling off
                  if (!value) {
                    setFormData(prev => ({ ...prev, minDaysLimit: null, maxDaysLimit: null }))
                  }
                }}
              />
            </div>
          </div>

          <div>
            {showDaysLimit && (
              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  type="number"
                  label="Minimum Days Limit"
                  labelPlacement="outside"
                  placeholder="1"
                  value={formData.minDaysLimit?.toString() || ''}
                  onValueChange={value => {
                    setFormData(prev => ({ ...prev, minDaysLimit: value ? parseInt(value) : null }))
                    clearError('daysLimit')
                  }}
                  min={1}
                  isInvalid={!!errors.daysLimit}
                />
                <Input
                  type="number"
                  label="Maximum Days Limit"
                  labelPlacement="outside"
                  placeholder="30"
                  value={formData.maxDaysLimit?.toString() || ''}
                  onValueChange={value => {
                    setFormData(prev => ({ ...prev, maxDaysLimit: value ? parseInt(value) : null }))
                    clearError('daysLimit')
                  }}
                  min={1}
                  isInvalid={!!errors.daysLimit}
                />
              </div>
            )}
            {errors.daysLimit && <p className="mt-1.5 text-sm text-danger">{errors.daysLimit}</p>}
          </div>

          {/* Multi-Day Discount Offers */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-base font-semibold text-foreground">
                Multi-Day Discount Offers
              </label>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                startContent={<Plus className="w-4 h-4" />}
                onPress={addDiscountTier}
              >
                Add Discount
              </Button>
            </div>
            <p className="mb-4 text-sm leading-normal text-default-500">
              Offer discounts for booking multiple days
            </p>

            {formData.discountTiers.length > 0 && (
              <div className="flex flex-col gap-4">
                {formData.discountTiers.map((tier, index) => (
                  <div key={index} className="flex items-end gap-3">
                    <Input
                      type="number"
                      label="Min Days"
                      labelPlacement="outside"
                      placeholder="5"
                      value={tier.minDays.toString()}
                      onValueChange={value => {
                        updateDiscountTier(index, 'minDays', parseInt(value) || 0)
                        clearError('discountTiers')
                      }}
                      min={1}
                      className="flex-1"
                      isInvalid={!!errors.discountTiers}
                    />
                    <Input
                      type="number"
                      label="Max Days (optional)"
                      labelPlacement="outside"
                      placeholder="10"
                      value={tier.maxDays?.toString() || ''}
                      onValueChange={value => {
                        updateDiscountTier(index, 'maxDays', value ? parseInt(value) : undefined)
                        clearError('discountTiers')
                      }}
                      min={1}
                      className="flex-1"
                      isInvalid={!!errors.discountTiers}
                    />
                    <Input
                      type="number"
                      label="Discount %"
                      labelPlacement="outside"
                      placeholder="10"
                      value={tier.discountPercent.toString()}
                      onValueChange={value => {
                        updateDiscountTier(index, 'discountPercent', parseFloat(value) || 0)
                        clearError('discountTiers')
                      }}
                      min={0}
                      max={100}
                      className="flex-1"
                      isInvalid={!!errors.discountTiers}
                    />
                    <Button
                      isIconOnly
                      color="danger"
                      variant="flat"
                      onPress={() => removeDiscountTier(index)}
                      className="mb-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {formData.discountTiers.length === 0 && (
              <div className="py-6 text-center text-sm text-default-400">
                No discount tiers added
              </div>
            )}
            {errors.discountTiers && (
              <p className="mt-1.5 text-sm text-danger">{errors.discountTiers}</p>
            )}
          </div>

          {/* Day-of-Week Pricing */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-base font-semibold text-foreground">Day-of-Week Pricing</label>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                startContent={<Plus className="w-4 h-4" />}
                onPress={addDayOfWeekPricing}
              >
                Add Day Pricing
              </Button>
            </div>
            <p className="mb-4 text-sm leading-normal text-default-500">
              Set different rates for specific days of the week
            </p>

            {formData.dayOfWeekPricing.length > 0 && (
              <div className="flex flex-col gap-4">
                {formData.dayOfWeekPricing.map((pricing, index) => {
                  const dayOptions = [
                    'Sunday',
                    'Monday',
                    'Tuesday',
                    'Wednesday',
                    'Thursday',
                    'Friday',
                    'Saturday',
                  ]
                  const selectedDay = dayOptions[pricing.dayOfWeek]

                  return (
                    <div key={index} className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="mb-1.5 block text-sm font-semibold text-foreground">
                          Day of Week
                        </label>
                        <SelectField
                          label="Day of Week"
                          value={selectedDay}
                          onChange={value => {
                            const dayIndex = dayOptions.indexOf(value)
                            updateDayOfWeekPricing(index, 'dayOfWeek', dayIndex)
                          }}
                          options={dayOptions}
                          placeholder="Select day"
                        />
                      </div>
                      <CurrencyInput
                        label="Price"
                        labelPlacement="outside"
                        placeholder="50"
                        value={pricing.price}
                        onValueChange={value => updateDayOfWeekPricing(index, 'price', value ?? 0)}
                        currency="USD"
                        className="flex-1"
                      />
                      <Button
                        isIconOnly
                        color="danger"
                        variant="flat"
                        onPress={() => removeDayOfWeekPricing(index)}
                        className="mb-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}

            {formData.dayOfWeekPricing.length === 0 && (
              <div className="py-6 text-center text-sm text-default-400">
                No day-of-week pricing added
              </div>
            )}
          </div>
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
          <div className="flex gap-4 mb-4">
            <div className="flex w-full items-center justify-between">
              <div>
                <label className="text-sm font-medium text-foreground">Unlimited Capacity</label>
                <p className="text-sm text-default-500">No limit on number of participants</p>
              </div>
              <Switch
                isSelected={formData.unlimitedCapacity}
                onValueChange={value => {
                  setFormData(prev => ({ ...prev, unlimitedCapacity: value }))
                  clearError('capacity')
                }}
              />
            </div>
            <div className="flex w-full">
              {!formData.unlimitedCapacity && (
                <Input
                  type="number"
                  label="Total Capacity"
                  labelPlacement="outside"
                  placeholder="50"
                  value={formData.capacity?.toString() || ''}
                  onValueChange={value => {
                    setFormData(prev => ({ ...prev, capacity: value ? parseInt(value) : null }))
                    clearError('capacity')
                    clearError('genderCapacity')
                  }}
                  min={1}
                  isRequired
                  isInvalid={!!errors.capacity}
                  errorMessage={errors.capacity}
                />
              )}
            </div>
          </div>

          {/* Age Group */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Age Group</label>
            <div className="grid md:grid-cols-2 gap-4">
              <Input
                type="number"
                label="Minimum Age"
                labelPlacement="outside"
                placeholder="5"
                value={formData.ageRange?.min.toString() || ''}
                onValueChange={value => {
                  setFormData(prev => ({
                    ...prev,
                    ageRange: {
                      min: value ? parseInt(value) : 0,
                      max: prev.ageRange?.max ?? 18,
                    },
                  }))
                  clearError('ageRange')
                }}
                min={0}
                max={100}
                isInvalid={!!errors.ageRange}
              />
              <Input
                type="number"
                label="Maximum Age"
                labelPlacement="outside"
                placeholder="18"
                value={formData.ageRange?.max.toString() || ''}
                onValueChange={value => {
                  setFormData(prev => ({
                    ...prev,
                    ageRange: {
                      min: prev.ageRange?.min ?? 0,
                      max: value ? parseInt(value) : 18,
                    },
                  }))
                  clearError('ageRange')
                }}
                min={0}
                max={100}
                isInvalid={!!errors.ageRange}
              />
            </div>
            {errors.ageRange && <p className="mt-1.5 text-sm text-danger">{errors.ageRange}</p>}
          </div>

          {/* Gender-based Capacity Limits */}
          {!formData.unlimitedCapacity && formData.capacity && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="text-sm font-medium text-foreground">
                    Do you want to limit boys and girls separately?
                  </label>
                  {campGender !== 'coed' && (
                    <p className="text-sm text-warning-400">
                      This option is only available for coed camps
                    </p>
                  )}
                </div>
                <Switch
                  isSelected={formData.separateGenderCapacity}
                  onValueChange={value => {
                    setFormData(prev => ({
                      ...prev,
                      separateGenderCapacity: value,
                      // Reset gender capacities when toggling off
                      boysCapacity: value ? prev.boysCapacity : null,
                      girlsCapacity: value ? prev.girlsCapacity : null,
                    }))
                    clearError('genderCapacity')
                  }}
                  isDisabled={campGender !== 'coed'}
                />
              </div>

              {formData.separateGenderCapacity && campGender === 'coed' && (
                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    type="number"
                    label="Boys Capacity"
                    labelPlacement="outside"
                    placeholder="25"
                    value={formData.boysCapacity?.toString() || ''}
                    onValueChange={value => {
                      const boysCapacity = value ? parseInt(value) : null
                      setFormData(prev => ({
                        ...prev,
                        boysCapacity,
                        // Auto-calculate girls capacity
                        girlsCapacity:
                          boysCapacity && prev.capacity
                            ? Math.max(0, prev.capacity - boysCapacity)
                            : prev.girlsCapacity,
                      }))
                      clearError('genderCapacity')
                    }}
                    min={0}
                    max={formData.capacity}
                    isInvalid={!!errors.genderCapacity}
                  />
                  <Input
                    type="number"
                    label="Girls Capacity"
                    labelPlacement="outside"
                    placeholder="25"
                    value={formData.girlsCapacity?.toString() || ''}
                    onValueChange={value => {
                      const girlsCapacity = value ? parseInt(value) : null
                      setFormData(prev => ({
                        ...prev,
                        girlsCapacity,
                        // Auto-calculate boys capacity
                        boysCapacity:
                          girlsCapacity && prev.capacity
                            ? Math.max(0, prev.capacity - girlsCapacity)
                            : prev.boysCapacity,
                      }))
                      clearError('genderCapacity')
                    }}
                    min={0}
                    max={formData.capacity}
                    isInvalid={!!errors.genderCapacity}
                  />
                </div>
              )}
              {errors.genderCapacity && (
                <p className="mt-1.5 text-sm text-danger">{errors.genderCapacity}</p>
              )}
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  )
}
