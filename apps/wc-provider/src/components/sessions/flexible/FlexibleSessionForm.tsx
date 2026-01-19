'use client'

import { useEffect, useState } from 'react'
import { Button, RangeCalendar, Select, SelectItem, Switch } from '@heroui/react'
import {
  CollapsibleSection,
  CurrencyInput,
  DayOfWeekSelector,
  Input,
  RichTextEditor,
} from '@world-schools/ui-web'
import { type CalendarDate, parseDate } from '@internationalized/date'
import type { RangeValue } from '@react-types/shared'
import { Plus, Trash2 } from 'lucide-react'
import type {
  AgeRange,
  BlackoutDate,
  DayOfWeekPricing,
  DiscountTier,
  Duration,
  FlexibleSession,
} from '@/types/sessions'
import { useSessionValidation } from '@/hooks/useSessionValidation'
import { formatDateForInput } from '@/utils/sessionFormatters'

interface FlexibleSessionFormProps {
  session?: FlexibleSession
  onSubmit: (data: FlexibleSessionFormData) => void
  onSubmitRef?: { current?: () => void }
}

export interface FlexibleSessionFormData {
  name: string
  description: string
  startDate: string
  endDate: string
  durations: Duration[]
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
export function FlexibleSessionForm({ session, onSubmit, onSubmitRef }: FlexibleSessionFormProps) {
  const validation = useSessionValidation()

  // Form state
  const [formData, setFormData] = useState<FlexibleSessionFormData>({
    name: session?.name || '',
    description: session?.description || '',
    startDate: session?.startDate ? formatDateForInput(session.startDate) : '',
    endDate: session?.endDate ? formatDateForInput(session.endDate) : '',
    durations: session?.durations ?? [{ weeks: 2, price: 0 }],
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

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Validate name
    const nameError = validation.validateSessionName(formData.name)
    if (nameError) newErrors.name = nameError

    // Validate dates
    const dateError = validation.validateDateRange(formData.startDate, formData.endDate)
    if (dateError) newErrors.dates = dateError

    // Validate durations
    const durationsError = validation.validateDurations(formData.durations)
    if (durationsError) newErrors.durations = durationsError

    // Validate blackout dates
    if (formData.blackoutDates.length > 0) {
      const blackoutError = validation.validateBlackoutDates(
        formData.blackoutDates,
        formData.startDate,
        formData.endDate
      )
      if (blackoutError) newErrors.blackoutDates = blackoutError
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
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
    <div className="space-y-6">
      {/* Section 1: Basic Information */}
      <CollapsibleSection title="1. Basic Information" defaultOpen={true}>
        <div className="space-y-6">
          <Input
            type="text"
            label="Session Title"
            labelPlacement="outside"
            placeholder="e.g., Summer 2024 Language Immersion"
            value={formData.name}
            onValueChange={value => setFormData(prev => ({ ...prev, name: value }))}
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
      <CollapsibleSection title="2. Dates & Availability" defaultOpen={true}>
        <div className="space-y-6">
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
              <div className="space-y-6">
                <div className="flex gap-4">
                  <Input
                    type="date"
                    label="Start Date"
                    labelPlacement="outside"
                    value={formData.startDate}
                    onValueChange={value => {
                      setFormData(prev => ({ ...prev, startDate: value }))
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
        </div>
      </CollapsibleSection>

      {/* Section 3: Rates & Pricing */}
      <CollapsibleSection title="3. Rates & Pricing" defaultOpen={true}>
        <div className="space-y-6">
          <div className="flex gap-4">
            {/* Base Price per Day */}
            <CurrencyInput
              label="Base Price per Day"
              labelPlacement="outside"
              placeholder="50"
              value={formData.basePricePerDay}
              onValueChange={value => setFormData(prev => ({ ...prev, basePricePerDay: value }))}
              currency="USD"
            />

            <div className="flex w-full items-center justify-between"></div>
          </div>

          {/* Min/Max Days Limit */}
          <div>
            <div className="mb-4 flex gap-4">
              <div className="flex w-full items-center justify-between">
                {/* Require Consecutive Days */}
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

            {showDaysLimit && (
              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  type="number"
                  label="Minimum Days Limit"
                  labelPlacement="outside"
                  placeholder="1"
                  value={formData.minDaysLimit?.toString() || ''}
                  onValueChange={value =>
                    setFormData(prev => ({ ...prev, minDaysLimit: value ? parseInt(value) : null }))
                  }
                  min={1}
                />
                <Input
                  type="number"
                  label="Maximum Days Limit"
                  labelPlacement="outside"
                  placeholder="30"
                  value={formData.maxDaysLimit?.toString() || ''}
                  onValueChange={value =>
                    setFormData(prev => ({ ...prev, maxDaysLimit: value ? parseInt(value) : null }))
                  }
                  min={1}
                />
              </div>
            )}
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
              <div className="space-y-3">
                {formData.discountTiers.map((tier, index) => (
                  <div key={index} className="flex items-end gap-3">
                    <Input
                      type="number"
                      label="Min Days"
                      labelPlacement="outside"
                      placeholder="5"
                      value={tier.minDays.toString()}
                      onValueChange={value =>
                        updateDiscountTier(index, 'minDays', parseInt(value) || 0)
                      }
                      min={1}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      label="Max Days (optional)"
                      labelPlacement="outside"
                      placeholder="10"
                      value={tier.maxDays?.toString() || ''}
                      onValueChange={value =>
                        updateDiscountTier(index, 'maxDays', value ? parseInt(value) : undefined)
                      }
                      min={1}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      label="Discount %"
                      labelPlacement="outside"
                      placeholder="10"
                      value={tier.discountPercent.toString()}
                      onValueChange={value =>
                        updateDiscountTier(index, 'discountPercent', parseFloat(value) || 0)
                      }
                      min={0}
                      max={100}
                      className="flex-1"
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
              <div className="space-y-3">
                {formData.dayOfWeekPricing.map((pricing, index) => (
                  <div key={index} className="flex items-end gap-3">
                    <Select
                      label="Day of Week"
                      labelPlacement="outside"
                      selectedKeys={[pricing.dayOfWeek.toString()]}
                      onSelectionChange={keys => {
                        const value = Array.from(keys)[0] as string
                        updateDayOfWeekPricing(index, 'dayOfWeek', parseInt(value))
                      }}
                      className="flex-1"
                    >
                      <SelectItem key="0">Sunday</SelectItem>
                      <SelectItem key="1">Monday</SelectItem>
                      <SelectItem key="2">Tuesday</SelectItem>
                      <SelectItem key="3">Wednesday</SelectItem>
                      <SelectItem key="4">Thursday</SelectItem>
                      <SelectItem key="5">Friday</SelectItem>
                      <SelectItem key="6">Saturday</SelectItem>
                    </Select>
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
                ))}
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
      <CollapsibleSection title="4. Capacity & Availability" defaultOpen={true}>
        <div className="space-y-6">
          {/* Total Capacity */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="text-sm font-medium text-foreground">Unlimited Capacity</label>
                <p className="text-sm text-default-500">No limit on number of participants</p>
              </div>
              <Switch
                isSelected={formData.unlimitedCapacity}
                onValueChange={value =>
                  setFormData(prev => ({ ...prev, unlimitedCapacity: value }))
                }
              />
            </div>

            {!formData.unlimitedCapacity && (
              <Input
                type="number"
                label="Total Capacity"
                labelPlacement="outside"
                placeholder="50"
                value={formData.capacity?.toString() || ''}
                onValueChange={value =>
                  setFormData(prev => ({ ...prev, capacity: value ? parseInt(value) : null }))
                }
                min={1}
              />
            )}
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
                onValueChange={value =>
                  setFormData(prev => ({
                    ...prev,
                    ageRange: {
                      min: value ? parseInt(value) : 0,
                      max: prev.ageRange?.max ?? 18,
                    },
                  }))
                }
                min={0}
                max={100}
              />
              <Input
                type="number"
                label="Maximum Age"
                labelPlacement="outside"
                placeholder="18"
                value={formData.ageRange?.max.toString() || ''}
                onValueChange={value =>
                  setFormData(prev => ({
                    ...prev,
                    ageRange: {
                      min: prev.ageRange?.min ?? 0,
                      max: value ? parseInt(value) : 18,
                    },
                  }))
                }
                min={0}
                max={100}
              />
            </div>
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
              <div className="space-y-3">
                {formData.blackoutDates.map((blackout, index) => (
                  <div key={index} className="flex items-end gap-3">
                    <Input
                      type="date"
                      label="Start Date"
                      labelPlacement="outside"
                      value={blackout.start}
                      onValueChange={value => updateBlackoutDate(index, 'start', value)}
                      className="flex-1"
                    />
                    <Input
                      type="date"
                      label="End Date"
                      labelPlacement="outside"
                      value={blackout.end}
                      onValueChange={value => updateBlackoutDate(index, 'end', value)}
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
    </div>
  )
}
