'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Accordion, AccordionItem, Button, Chip, DateRangePicker, Progress } from '@heroui/react'
import { BadgeCheck, ChevronLeft } from 'lucide-react'
import { CalendarDate } from '@internationalized/date'

import {
  Autocomplete,
  ChipButton,
  Input,
  RangeSlider,
  SelectField,
  Textarea,
} from '@world-schools/ui-web'

import {
  ACTIVITY_OPTIONS,
  type Camp,
  CAMP_STATUS_OPTIONS,
  CAMP_TYPE_OPTIONS,
  FACILITY_OPTIONS,
  LOCATION_SUGGESTIONS,
  SPECIAL_NEEDS_OPTIONS,
} from '@/types/camp'

import { useCampsStore } from '@/stores/camps-store'

interface CampFormProps {
  campId: string
}

const MIN_PRICE = 0
const MAX_PRICE = 100000

export const CampForm: React.FC<CampFormProps> = ({ campId }) => {
  const router = useRouter()
  const {
    getCampById,
    addCamp,
    updateCamp,
    getBasicInfoProgress,
    getProgramProgress,
    getPricingProgress,
    getFacilitiesProgress,
    getOverallProgress,
  } = useCampsStore()

  const isNew = campId === 'new'
  const existing = isNew ? null : getCampById(campId)

  // Form state
  const [initialFormData, setInitialFormData] = useState<
    Omit<Camp, 'id' | 'createdAt' | 'updatedAt'>
  >(() => {
    if (existing) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = existing
      return rest
    }
    return {
      name: '',
      description: '',
      status: 'draft',
      capacity: 0,
      minAge: undefined,
      maxAge: undefined,
      locations: [],
      campTypes: [],
      dateRange: { startDate: undefined, endDate: undefined },
      activities: [],
      priceRange: [MIN_PRICE, MAX_PRICE],
      facilities: [],
      specialNeeds: [],
      enrolled: 0,
    }
  })

  const [formData, setFormData] = useState<Omit<Camp, 'id' | 'createdAt' | 'updatedAt'>>(
    () => initialFormData
  )

  // UI helpers
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [showAllActivities, setShowAllActivities] = useState(false)
  const [showAllFacilities, setShowAllFacilities] = useState(false)
  const [showAllSpecialNeeds, setShowAllSpecialNeeds] = useState(false)

  useEffect(() => {
    if (existing) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = existing
      setFormData(rest)
      setInitialFormData(rest)
    } else {
      const empty = {
        name: '',
        description: '',
        status: 'draft' as const,
        capacity: 0,
        minAge: undefined as number | undefined,
        maxAge: undefined as number | undefined,
        locations: [],
        campTypes: [],
        dateRange: {
          startDate: undefined as Date | undefined,
          endDate: undefined as Date | undefined,
        },
        activities: [],
        priceRange: [MIN_PRICE, MAX_PRICE] as [number, number],
        facilities: [],
        specialNeeds: [],
        enrolled: 0,
      }
      setFormData(empty)
      setInitialFormData(empty)
    }
  }, [existing])

  const isModified = useMemo(() => {
    try {
      return JSON.stringify(formData) !== JSON.stringify(initialFormData)
    } catch {
      return true
    }
  }, [formData, initialFormData])

  // Derived
  const current: Camp = {
    ...(formData as any),
    id: campId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const _basic = getBasicInfoProgress(current)
  const _program = getProgramProgress(current)
  const _pricing = getPricingProgress(current)
  const _facilities = getFacilitiesProgress(current)
  const overallProgress = getOverallProgress(current)

  const filteredSuggestions = useMemo(() => {
    if (!query) return LOCATION_SUGGESTIONS
    return LOCATION_SUGGESTIONS.filter(loc => loc.toLowerCase().includes(query.toLowerCase()))
  }, [query])

  // Validation
  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!formData.name.trim()) next.name = 'Camp name is required'
    if (!formData.capacity || formData.capacity <= 0)
      next.capacity = 'Capacity must be greater than 0'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // Helpers
  const updateField = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const toggleFromArray = (
    key: 'locations' | 'campTypes' | 'activities' | 'facilities' | 'specialNeeds',
    value: string
  ) => {
    setFormData(prev => {
      const set = new Set(prev[key] as string[])
      if (set.has(value)) set.delete(value)
      else set.add(value)
      return { ...prev, [key]: Array.from(set) as any }
    })
  }

  const convertDateToCalendarDate = (date: Date): CalendarDate => {
    return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
  }

  const convertCalendarDateToDate = (calendarDate: any): Date | undefined => {
    if (!calendarDate) return undefined
    return new Date(calendarDate.year, calendarDate.month - 1, calendarDate.day)
  }

  // Save
  const handleSave = async () => {
    if (!validate()) return
    setIsSaving(true)
    try {
      if (isNew) {
        addCamp(formData)
      } else {
        updateCamp(campId, formData)
      }
      router.push('/admin/settings/camps')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRevert = () => {
    setFormData(initialFormData)
    setErrors({})
  }

  const handleCancel = () => {
    router.push('/admin/settings/camps')
  }

  const isPriceInvalid = formData.priceRange[0] > formData.priceRange[1]
  const pageTitle = isNew ? 'Add a camp' : existing?.name || 'Edit camp'

  return (
    <div className="min-h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Sticky Page Header */}
      <div className="sticky top-0 z-30 bg-white shadow-[0_24px_16px_-2px_rgba(255,255,255,0.8)] dark:bg-gray-900 dark:shadow-[0_24px_16px_-2px_rgba(17,24,39,0.8)] mb-6">
        <div className="h-20 px-10 mb-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-700/50">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pageTitle}</h1>
            {!isNew && isModified && (
              <Chip color="warning" variant="flat" radius="full" className="h-6">
                Modified
              </Chip>
            )}
          </div>
          <div className="flex flex-col items-end">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Overall Progress</div>
            <div className="flex items-center space-x-2">
              <Progress
                value={overallProgress}
                className="w-32"
                size="md"
                color="primary"
                radius="full"
                showValueLabel={false}
                classNames={{ track: 'bg-gray-200 dark:bg-gray-700', indicator: 'bg-primary' }}
              />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {overallProgress}%
              </span>
              {overallProgress >= 100 && (
                <BadgeCheck
                  size={20}
                  fill="current"
                  className="stroke-white fill-blue-600 dark:fill-blue-400"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <Accordion
          selectionMode="multiple"
          defaultExpandedKeys={['basic', 'facilities', 'special']}
          className="space-y-6"
        >
          {/* Basic Information */}
          <AccordionItem
            key="basic"
            title={
              <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Basic Information
              </span>
            }
            classNames={{
              base: 'bg-transparent',
              title: 'text-2xl font-semibold',
              subtitle: 'text-secondary',
              trigger: 'py-0 cursor-pointer',
              content: 'pt-6',
            }}
            indicator={<ChevronLeft size={24} className="text-secondary" />}
          >
            <div className="space-y-6">
              <div>
                <Input
                  label="Camp Name"
                  labelPlacement="outside"
                  isRequired
                  value={formData.name}
                  onValueChange={v => updateField('name', v)}
                  placeholder="Enter camp name"
                  className="w-full"
                  isInvalid={!!errors.name}
                  errorMessage={errors.name}
                  classNames={{
                    inputWrapper:
                      'border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
                  }}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <SelectField
                    value={formData.status}
                    onChange={v => updateField('status', v as any)}
                    options={CAMP_STATUS_OPTIONS.map(s => s.label)}
                    placeholder="Select status"
                    label="Camp status"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Capacity
                  </label>
                  <Input
                    value={String(formData.capacity)}
                    onValueChange={v => updateField('capacity', parseInt(v) || 0)}
                    placeholder="Maximum number of campers"
                    type="number"
                    className="w-full"
                    isInvalid={!!errors.capacity}
                    errorMessage={errors.capacity}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Minimum Age
                  </label>
                  <Input
                    value={formData.minAge !== undefined ? String(formData.minAge) : ''}
                    onValueChange={v =>
                      updateField('minAge', v === '' ? undefined : parseInt(v) || 0)
                    }
                    placeholder="Minimum age"
                    type="number"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Maximum Age
                  </label>
                  <Input
                    value={formData.maxAge !== undefined ? String(formData.maxAge) : ''}
                    onValueChange={v =>
                      updateField('maxAge', v === '' ? undefined : parseInt(v) || 0)
                    }
                    placeholder="Maximum age"
                    type="number"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <Textarea
                  value={formData.description || ''}
                  onValueChange={v => updateField('description', v)}
                  placeholder="Describe the camp and its activities"
                  className="w-full"
                  minRows={3}
                />
              </div>

              {/* Program: Locations, Types, Dates, Activities */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Where?
                </h3>
                <Autocomplete
                  value={query}
                  onChangeText={setQuery}
                  onSelect={(loc: string) => {
                    if (!loc.trim()) return
                    if (!formData.locations.includes(loc)) {
                      updateField('locations', [...formData.locations, loc])
                    }
                    setQuery('')
                  }}
                  suggestions={filteredSuggestions}
                  placeholder="Add location"
                  className="mb-4"
                />
                <div className="flex flex-wrap gap-2">
                  {formData.locations.map(loc => (
                    <ChipButton
                      key={loc}
                      label={loc}
                      canClose
                      selected
                      onPress={() =>
                        updateField(
                          'locations',
                          formData.locations.filter(l => l !== loc)
                        )
                      }
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Type of camp
                </h3>
                <div className="flex flex-wrap gap-2">
                  {CAMP_TYPE_OPTIONS.map(opt => {
                    const isSelected = formData.campTypes.includes(opt.id)
                    return (
                      <ChipButton
                        key={opt.id}
                        label={opt.label}
                        selected={isSelected}
                        onPress={() => toggleFromArray('campTypes', opt.id)}
                      />
                    )
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Camp Dates
                </h3>
                <div className="flex items-center justify-between">
                  <DateRangePicker
                    showMonthAndYearPickers
                    aria-label="Camp date range"
                    placeholderValue={new CalendarDate(2024, 6, 1)}
                    value={
                      formData.dateRange.startDate && formData.dateRange.endDate
                        ? {
                            start: convertDateToCalendarDate(formData.dateRange.startDate),
                            end: convertDateToCalendarDate(formData.dateRange.endDate),
                          }
                        : null
                    }
                    onChange={range => {
                      if (range?.start && range?.end) {
                        updateField('dateRange', {
                          startDate: convertCalendarDateToDate(range.start),
                          endDate: convertCalendarDateToDate(range.end),
                        } as any)
                      } else {
                        updateField('dateRange', {
                          startDate: undefined,
                          endDate: undefined,
                        } as any)
                      }
                    }}
                    classNames={{
                      base: 'w-auto min-w-[200px] flex-1',
                      inputWrapper:
                        'h-12 rounded-lg bg-white border-2 border-gray-300 dark:border-gray-600',
                      input: 'text-sm',
                    }}
                    size="md"
                    variant="flat"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Activities
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(showAllActivities ? ACTIVITY_OPTIONS : ACTIVITY_OPTIONS.slice(0, 20)).map(
                    opt => {
                      const isSelected = formData.activities.includes(opt.id)
                      return (
                        <ChipButton
                          key={opt.id}
                          label={opt.label}
                          selected={isSelected}
                          onPress={() => toggleFromArray('activities', opt.id)}
                        />
                      )
                    }
                  )}
                </div>
                {ACTIVITY_OPTIONS.length > 20 && (
                  <Button
                    variant="light"
                    size="sm"
                    onPress={() => setShowAllActivities(!showAllActivities)}
                    className="mt-2"
                  >
                    {showAllActivities ? 'Show less' : 'Show more'}
                  </Button>
                )}
              </div>

              {/* Pricing */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Price range
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Price per day including fees
                </p>
                <div className="mb-2">
                  <RangeSlider
                    min={MIN_PRICE}
                    max={MAX_PRICE}
                    step={100}
                    values={formData.priceRange}
                    onChange={vals => {
                      updateField('priceRange', vals as [number, number])
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Min
                    </label>
                    <Input
                      value={String(formData.priceRange[0])}
                      onValueChange={val => {
                        const num = parseInt(val) || 0
                        if (num <= formData.priceRange[1])
                          updateField('priceRange', [num, formData.priceRange[1]])
                      }}
                      startContent="$"
                      placeholder="0"
                      classNames={{ inputWrapper: isPriceInvalid ? 'border-red-500' : '' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max
                    </label>
                    <Input
                      value={String(formData.priceRange[1])}
                      onValueChange={val => {
                        const num = parseInt(val) || 0
                        if (num >= formData.priceRange[0])
                          updateField('priceRange', [formData.priceRange[0], num])
                      }}
                      startContent="$"
                      placeholder="100000"
                      classNames={{ inputWrapper: isPriceInvalid ? 'border-red-500' : '' }}
                    />
                  </div>
                </div>
                {isPriceInvalid && (
                  <p className="text-red-500 text-sm">
                    Minimum price cannot be greater than maximum price
                  </p>
                )}
              </div>
            </div>
          </AccordionItem>

          {/* Facilities */}
          <AccordionItem
            key="facilities"
            title={
              <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Facilities
              </span>
            }
            classNames={{
              base: 'bg-transparent',
              title: 'text-2xl font-semibold',
              subtitle: 'text-secondary',
              trigger: 'py-0 cursor-pointer',
              content: 'pt-6',
            }}
            indicator={<ChevronLeft size={24} className="text-secondary" />}
          >
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {(showAllFacilities ? FACILITY_OPTIONS : FACILITY_OPTIONS.slice(0, 20)).map(
                  facility => {
                    const isSelected = formData.facilities.includes(facility)
                    return (
                      <ChipButton
                        key={facility}
                        label={facility}
                        selected={isSelected}
                        onPress={() => toggleFromArray('facilities', facility)}
                      />
                    )
                  }
                )}
              </div>
              {FACILITY_OPTIONS.length > 20 && (
                <Button
                  variant="light"
                  size="sm"
                  onPress={() => setShowAllFacilities(!showAllFacilities)}
                  className="mt-2"
                >
                  {showAllFacilities ? 'Show less' : 'Show more'}
                </Button>
              )}
            </div>
          </AccordionItem>

          {/* Special Needs */}
          <AccordionItem
            key="special"
            title={
              <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Special Needs
              </span>
            }
            classNames={{
              base: 'bg-transparent',
              title: 'text-2xl font-semibold',
              subtitle: 'text-secondary',
              trigger: 'py-0 cursor-pointer',
              content: 'pt-6',
            }}
            indicator={<ChevronLeft size={24} className="text-secondary" />}
          >
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {(showAllSpecialNeeds
                  ? SPECIAL_NEEDS_OPTIONS
                  : SPECIAL_NEEDS_OPTIONS.slice(0, 20)
                ).map(need => {
                  const isSelected = formData.specialNeeds.includes(need)
                  return (
                    <ChipButton
                      key={need}
                      label={need}
                      selected={isSelected}
                      onPress={() => toggleFromArray('specialNeeds', need)}
                    />
                  )
                })}
              </div>
              {SPECIAL_NEEDS_OPTIONS.length > 20 && (
                <Button
                  variant="light"
                  size="sm"
                  onPress={() => setShowAllSpecialNeeds(!showAllSpecialNeeds)}
                  className="mt-2"
                >
                  {showAllSpecialNeeds ? 'Show less' : 'Show more'}
                </Button>
              )}
            </div>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 bg-white shadow-[0_-24px_16px_-2px_rgba(255,255,255,0.8)] dark:bg-gray-900 dark:shadow-[0_-24px_16px_-2px_rgba(17,24,39,0.8)] border-t border-gray-200 dark:border-gray-700 mt-6">
        <div className="flex p-4 px-8">
          {!isNew && isModified && (
            <Button
              variant="bordered"
              size="lg"
              radius="full"
              onPress={handleRevert}
              isDisabled={isSaving}
              disabled={isSaving}
              color="danger"
              className="px-8 mr-auto"
            >
              Revert
            </Button>
          )}
          <div className="flex ml-auto items-center gap-2">
            <Button
              variant="bordered"
              size="lg"
              radius="full"
              onPress={handleCancel}
              isDisabled={isSaving}
              disabled={isSaving}
              className="px-8"
            >
              Cancel
            </Button>
            {(() => {
              const canSave = isModified && !isSaving && !isPriceInvalid
              return (
                <Button
                  color="primary"
                  size="lg"
                  radius="full"
                  onPress={handleSave}
                  isLoading={isSaving}
                  isDisabled={!canSave}
                  className="px-8"
                >
                  {isSaving ? 'Saving...' : isNew ? 'Add Camp' : 'Save Changes'}
                </Button>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
