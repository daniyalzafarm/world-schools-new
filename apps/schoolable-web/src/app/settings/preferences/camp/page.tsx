'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Accordion, AccordionItem, Button, Chip, DateRangePicker, Progress } from '@heroui/react'
import { BadgeCheck, ChevronLeft, X } from 'lucide-react'
import { Autocomplete, ChipButton, Input, RangeSlider, ShowMoreButton } from "@world-schools/ui-web"
import { CalendarDate } from '@internationalized/date'
import { ProtectedRoute } from '@/components/auth/protected-route'

// Constants from mobile implementation
const LOCATION_SUGGESTIONS = [
  'New York',
  'Los Angeles',
  'Chicago',
  'Houston',
  'Phoenix',
  'Philadelphia',
  'San Antonio',
  'San Diego',
  'Dallas',
  'San Jose',
]

const MIN_PRICE = 0
const MAX_PRICE = 100000

const CAMP_TYPES = [
  { id: 'day', label: 'Day Camp' },
  { id: 'residential', label: 'Residential' },
  { id: 'online', label: 'Online' },
]

const DATES = [
  { id: 'easter', label: 'Easter Holidays', sub: 'Apr 20 - May 1' },
  { id: 'autumn', label: 'Autumn Holidays', sub: 'Apr 30 - May 1' },
  { id: 'summer', label: 'Summer Holidays', sub: 'Jun 30 - Aug 15' },
]

// Preset ranges mapped to current year
const thisYear = new Date().getFullYear()
const PRESET_RANGES: Record<string, { startDate: Date; endDate: Date }> = {
  easter: {
    startDate: new Date(thisYear, 3, 20), // April 20
    endDate: new Date(thisYear, 4, 1), // May 1
  },
  autumn: {
    startDate: new Date(thisYear, 3, 30), // April 30
    endDate: new Date(thisYear, 4, 1), // May 1
  },
  summer: {
    startDate: new Date(thisYear, 5, 30), // June 30
    endDate: new Date(thisYear, 7, 15), // August 15
  },
}

const ACTIVITIES = [
  { id: 'language', label: 'Language lessons' },
  { id: 'multisport', label: 'Multisport' },
  { id: 'soccer', label: 'Soccer' },
  { id: 'coding', label: 'Coding' },
  { id: 'robotics', label: 'Robotics' },
  { id: 'arts_crafts', label: 'Arts & crafts' },
  { id: 'swimming', label: 'Swimming' },
  { id: 'tennis', label: 'Tennis' },
]

const FACILITIES = [
  'Accommodation',
  'Meals',
  'Medical Staff',
  'Indoor Courts',
  'Outdoor Fields',
  'Swimming Pool',
]

const SPECIAL_NEEDS = [
  'Dietary Needs',
  'Physical Disabilities',
  'Language Support',
  'Autism Support',
  'ADHD Support',
]

export default function CampPreferencesPage() {
  const router = useRouter()

  // Location state
  const [query, setQuery] = useState('')
  const [locations, setLocations] = useState<string[]>(['Ohio', 'Texas'])

  // Camp type state
  const [selectedCampTypes, setSelectedCampTypes] = useState<Set<string>>(new Set(['day']))

  // Dates state
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())

  // Date range picker state (similar to mobile implementation)
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>()
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>()
  const [isCustomRange, setIsCustomRange] = useState(false)

  // Activities state
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set())
  const [showAllActivities, setShowAllActivities] = useState(false)

  // Price range state
  const [priceRange, setPriceRange] = useState<[number, number]>([1000, 55000])
  const [minPriceText, setMinPriceText] = useState(String(priceRange[0]))
  const [maxPriceText, setMaxPriceText] = useState(String(priceRange[1]))

  // Facilities state
  const [selectedFacilities, setSelectedFacilities] = useState<Set<string>>(new Set())
  const [showAllFacilities, setShowAllFacilities] = useState(false)

  // Special needs state
  const [selectedSpecialNeeds, setSelectedSpecialNeeds] = useState<Set<string>>(new Set())
  const [showAllSpecialNeeds, setShowAllSpecialNeeds] = useState(false)

  // Loading and error states
  const [isSaving, setIsSaving] = useState(false)
  const [_errors, setErrors] = useState<Record<string, string>>({})

  // Initial snapshot for dirty-state tracking
  const [initialSnapshot] = useState(() => ({
    locations: [...locations],
    selectedCampTypes: new Set(selectedCampTypes),
    selectedDates: new Set(selectedDates),
    customStartDate,
    customEndDate,
    isCustomRange,
    priceRange: [...priceRange] as [number, number],
    selectedActivities: new Set(selectedActivities),
    selectedFacilities: new Set(selectedFacilities),
    selectedSpecialNeeds: new Set(selectedSpecialNeeds),
  }))

  const currentSnapshot = useMemo(
    () => ({
      locations,
      selectedCampTypes,
      selectedDates,
      customStartDate,
      customEndDate,
      isCustomRange,
      priceRange,
      selectedActivities,
      selectedFacilities,
      selectedSpecialNeeds,
    }),
    [
      locations,
      selectedCampTypes,
      selectedDates,
      customStartDate,
      customEndDate,
      isCustomRange,
      priceRange,
      selectedActivities,
      selectedFacilities,
      selectedSpecialNeeds,
    ]
  )

  const isModified = useMemo(() => {
    const normalize = (snap: any) => ({
      locations: snap.locations,
      selectedCampTypes: Array.from(snap.selectedCampTypes),
      selectedDates: Array.from(snap.selectedDates),
      customStartDate: snap.customStartDate ? snap.customStartDate.toISOString() : null,
      customEndDate: snap.customEndDate ? snap.customEndDate.toISOString() : null,
      isCustomRange: snap.isCustomRange,
      priceRange: snap.priceRange,
      selectedActivities: Array.from(snap.selectedActivities),
      selectedFacilities: Array.from(snap.selectedFacilities),
      selectedSpecialNeeds: Array.from(snap.selectedSpecialNeeds),
    })
    try {
      return (
        JSON.stringify(normalize(currentSnapshot)) !== JSON.stringify(normalize(initialSnapshot))
      )
    } catch {
      return true
    }
  }, [currentSnapshot, initialSnapshot])

  // Calculate progress for each section
  const locationProgress = locations.length > 0 ? 100 : 0
  const campTypeProgress = selectedCampTypes.size > 0 ? 100 : 0
  const dateProgress =
    selectedDates.size > 0 || (customStartDate && customEndDate && isCustomRange) ? 100 : 0
  const activityProgress = selectedActivities.size > 0 ? 100 : 0
  const priceProgress = priceRange[0] > 0 || priceRange[1] < MAX_PRICE ? 100 : 0
  const facilityProgress = selectedFacilities.size > 0 ? 100 : 0
  const specialNeedsProgress = selectedSpecialNeeds.size > 0 ? 100 : 0

  const overallProgress = Math.round(
    (locationProgress +
      campTypeProgress +
      dateProgress +
      activityProgress +
      priceProgress +
      facilityProgress +
      specialNeedsProgress) /
      7
  )

  // Filter suggestions based on query
  const filteredSuggestions = useMemo(() => {
    if (!query) return LOCATION_SUGGESTIONS
    return LOCATION_SUGGESTIONS.filter(loc => loc.toLowerCase().includes(query.toLowerCase()))
  }, [query])

  const handleLocationSelect = (location: string) => {
    if (!location.trim()) return
    if (!locations.includes(location)) {
      setLocations(prev => [...prev, location])
    }
    setQuery('')
  }

  const handleRemoveLocation = (location: string) => {
    setLocations(prev => prev.filter(loc => loc !== location))
  }

  const toggleSelection = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>
  ) => {
    setter(prev => {
      const copy = new Set(prev)
      if (copy.has(value)) {
        copy.delete(value)
      } else {
        copy.add(value)
      }
      return copy
    })
  }

  // Helper functions to convert between Date and CalendarDate for Hero UI
  const convertDateToCalendarDate = (date: Date): CalendarDate => {
    return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
  }

  const convertCalendarDateToDate = (calendarDate: any): Date | undefined => {
    if (!calendarDate) return undefined
    return new Date(calendarDate.year, calendarDate.month - 1, calendarDate.day)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Determine effective date range: prefer custom, otherwise derive from presets
      let effStart: Date | undefined =
        isCustomRange && customStartDate && customEndDate ? customStartDate : undefined
      let effEnd: Date | undefined =
        isCustomRange && customStartDate && customEndDate ? customEndDate : undefined

      // If no custom range, calculate from predefined dates
      if (!effStart || !effEnd) {
        const ids = Array.from(selectedDates)
        const ranges = ids
          .map(id => PRESET_RANGES[id])
          .filter((r): r is { startDate: Date; endDate: Date } => !!r)
        if (ranges.length > 0) {
          const startTimes = ranges.map(r => r.startDate.getTime())
          const endTimes = ranges.map(r => r.endDate.getTime())
          const minStart = new Date(Math.min(...startTimes))
          const maxEnd = new Date(Math.max(...endTimes))
          effStart = minStart
          effEnd = maxEnd
        }
      }

      const _payload = {
        locations,
        campTypes: Array.from(selectedCampTypes),
        dates: Array.from(selectedDates),
        dateRange: { startDate: effStart, endDate: effEnd },
        activities: Array.from(selectedActivities),
        priceRange,
        facilities: Array.from(selectedFacilities),
        specialNeeds: Array.from(selectedSpecialNeeds),
      }
      // console.warn('Camp Preferences:', payload)
      // console.warn('Custom date range:', { customStartDate, customEndDate, isCustomRange })
      // console.warn('Selected preset dates:', Array.from(selectedDates))
      router.back()
    } catch (error) {
      console.error('Error saving camp preferences:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    router.back()
  }

  const handleRevert = () => {
    setLocations([...initialSnapshot.locations])
    setSelectedCampTypes(new Set(initialSnapshot.selectedCampTypes))
    setSelectedDates(new Set(initialSnapshot.selectedDates))
    setCustomStartDate(initialSnapshot.customStartDate)
    setCustomEndDate(initialSnapshot.customEndDate)
    setIsCustomRange(initialSnapshot.isCustomRange)
    setPriceRange([...initialSnapshot.priceRange] as [number, number])
    setMinPriceText(String(initialSnapshot.priceRange[0]))
    setMaxPriceText(String(initialSnapshot.priceRange[1]))
    setSelectedActivities(new Set(initialSnapshot.selectedActivities))
    setSelectedFacilities(new Set(initialSnapshot.selectedFacilities))
    setSelectedSpecialNeeds(new Set(initialSnapshot.selectedSpecialNeeds))
    setErrors({})
  }

  const isPriceInvalid = priceRange[0] > priceRange[1]

  // Date range display logic
  const dateRangeSelected = !!customStartDate && !!customEndDate && isCustomRange
  const _dateRangeLabel = dateRangeSelected
    ? `${customStartDate.toLocaleDateString()} - ${customEndDate.toLocaleDateString()}`
    : 'Choose dates'

  return (
    <ProtectedRoute requireAuth={true} requireUser={true}>
      <div className="min-h-full flex flex-col bg-white dark:bg-gray-900">
        {/* Sticky Page Header */}
        <div className="sticky top-0 z-30 bg-white shadow-[0_24px_16px_-2px_rgba(255,255,255,0.8)] dark:bg-gray-900 dark:shadow-[0_24px_16px_-2px_rgba(17,24,39,0.8)] mb-6">
          <div className="h-20 px-10 mb-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-700/50">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Camp Preferences
              </h1>
              {isModified && (
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
                  classNames={{
                    track: 'bg-gray-200 dark:bg-gray-700',
                    indicator: 'bg-primary',
                  }}
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
          <div className="bg-white dark:bg-gray-800 space-y-8">
            {/* General, Activities, Facilities & Special Needs (Collapsible) */}
            <Accordion
              selectionMode="multiple"
              defaultExpandedKeys={['general', 'activities', 'facilities', 'special']}
              className="space-y-6"
            >
              <AccordionItem
                key="general"
                title={
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                      General
                    </span>
                  </div>
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
                <div className="space-y-8">
                  {/* Location Section */}
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      Where?
                    </h3>
                    <Autocomplete
                      value={query}
                      onChangeText={setQuery}
                      onSelect={handleLocationSelect}
                      suggestions={filteredSuggestions}
                      placeholder="Add location"
                      className="mb-4"
                    />
                    <div className="flex flex-wrap">
                      {locations.map(loc => (
                        <ChipButton
                          key={loc}
                          label={loc}
                          canClose
                          selected
                          onPress={() => handleRemoveLocation(loc)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Type of Camp */}
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      Type of camp
                    </h3>
                    <div className="flex flex-wrap">
                      {CAMP_TYPES.map(opt => {
                        const isSelected = selectedCampTypes.has(opt.id)
                        return (
                          <ChipButton
                            key={opt.id}
                            label={opt.label}
                            selected={isSelected}
                            onPress={() => toggleSelection(opt.id, setSelectedCampTypes)}
                          />
                        )
                      })}
                    </div>
                  </div>

                  {/* Dates */}
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      Dates
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {DATES.map(opt => {
                        const isSelected = selectedDates.has(opt.id)
                        return (
                          <ChipButton
                            key={opt.id}
                            className="h-12 rounded-lg"
                            label={`${opt.label} (${opt.sub})`}
                            selected={isSelected}
                            onPress={() => {
                              toggleSelection(opt.id, setSelectedDates)
                            }}
                          />
                        )
                      })}

                      {/* Custom Date Range Picker */}
                      <div
                        className={`
                ${
                  dateRangeSelected && isCustomRange
                    ? 'bg-white dark:bg-gray-700 border-primary-500 rounded-lg'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }
              `}
                      >
                        <div className="flex items-center justify-between">
                          <DateRangePicker
                            showMonthAndYearPickers
                            aria-label="Custom date range"
                            placeholderValue={new CalendarDate(2024, 6, 1)}
                            value={
                              customStartDate && customEndDate
                                ? {
                                    start: convertDateToCalendarDate(customStartDate),
                                    end: convertDateToCalendarDate(customEndDate),
                                  }
                                : null
                            }
                            onChange={range => {
                              if (range?.start && range?.end) {
                                setCustomStartDate(convertCalendarDateToDate(range.start))
                                setCustomEndDate(convertCalendarDateToDate(range.end))
                                setIsCustomRange(true)
                              } else {
                                setCustomStartDate(undefined)
                                setCustomEndDate(undefined)
                                setIsCustomRange(false)
                              }
                            }}
                            classNames={{
                              base: 'w-auto min-w-[200px] flex-1',
                              inputWrapper: `h-12 rounded-lg bg-white border ${dateRangeSelected ? 'bg-primary-100 hover:bg-primary-100 hover:opacity-80 border-primary-100' : 'border-gray-300'}`,
                              input: 'text-sm',
                            }}
                            size="md"
                            variant="flat"
                          />

                          {dateRangeSelected && isCustomRange && (
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              onPress={() => {
                                setCustomStartDate(undefined)
                                setCustomEndDate(undefined)
                                setIsCustomRange(false)
                              }}
                              className="ml-1 text-gray-500 hover:text-gray-700"
                            >
                              <X size={16} />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Price Range */}
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      Price range
                    </h3>
                    <div className="mb-6">
                      <RangeSlider
                        min={MIN_PRICE}
                        max={MAX_PRICE}
                        step={100}
                        values={priceRange}
                        onChange={vals => {
                          setPriceRange(vals)
                          setMinPriceText(String(vals[0]))
                          setMaxPriceText(String(vals[1]))
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Input
                          label="Min"
                          labelPlacement="outside"
                          value={minPriceText}
                          onValueChange={value => {
                            setMinPriceText(value)
                            const num = parseInt(value) || 0
                            if (num <= priceRange[1]) {
                              setPriceRange([num, priceRange[1]])
                            }
                          }}
                          startContent="$"
                          placeholder="0"
                          classNames={{
                            inputWrapper: isPriceInvalid ? 'border-red-500' : 'border-gray-200',
                          }}
                        />
                      </div>
                      <div>
                        <Input
                          label="Max"
                          labelPlacement="outside"
                          value={maxPriceText}
                          onValueChange={value => {
                            setMaxPriceText(value)
                            const num = parseInt(value) || 0
                            if (num >= priceRange[0]) {
                              setPriceRange([priceRange[0], num])
                            }
                          }}
                          startContent="$"
                          placeholder="100000"
                          classNames={{
                            inputWrapper: isPriceInvalid ? 'border-red-500' : 'border-gray-200',
                          }}
                        />
                      </div>
                    </div>
                    {isPriceInvalid && (
                      <p className="text-red-500 text-sm mt-2">
                        Minimum price cannot be greater than maximum price
                      </p>
                    )}
                  </div>
                </div>
              </AccordionItem>
              <AccordionItem
                key="activities"
                title={
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                      Activities
                    </span>
                  </div>
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
                <div className="flex flex-wrap">
                  {(showAllActivities ? ACTIVITIES : ACTIVITIES.slice(0, 20)).map(opt => {
                    const isSelected = selectedActivities.has(opt.id)
                    return (
                      <ChipButton
                        key={opt.id}
                        label={opt.label}
                        selected={isSelected}
                        onPress={() => toggleSelection(opt.id, setSelectedActivities)}
                      />
                    )
                  })}
                </div>
                {ACTIVITIES.length > 20 && (
                  <ShowMoreButton
                    isExpanded={showAllActivities}
                    onToggle={() => setShowAllActivities(!showAllActivities)}
                  />
                )}
              </AccordionItem>

              <AccordionItem
                key="facilities"
                title={
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                      Facilities
                    </span>
                  </div>
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
                <div className="flex flex-wrap">
                  {(showAllFacilities ? FACILITIES : FACILITIES.slice(0, 20)).map(facility => {
                    const isSelected = selectedFacilities.has(facility)
                    return (
                      <ChipButton
                        key={facility}
                        label={facility}
                        selected={isSelected}
                        onPress={() => toggleSelection(facility, setSelectedFacilities)}
                      />
                    )
                  })}
                </div>
                {FACILITIES.length > 20 && (
                  <ShowMoreButton
                    isExpanded={showAllFacilities}
                    onToggle={() => setShowAllFacilities(!showAllFacilities)}
                  />
                )}
              </AccordionItem>

              <AccordionItem
                key="special"
                title={
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                      Special Needs
                    </span>
                  </div>
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
                <div className="flex flex-wrap">
                  {(showAllSpecialNeeds ? SPECIAL_NEEDS : SPECIAL_NEEDS.slice(0, 20)).map(need => {
                    const isSelected = selectedSpecialNeeds.has(need)
                    return (
                      <ChipButton
                        key={need}
                        label={need}
                        selected={isSelected}
                        onPress={() => toggleSelection(need, setSelectedSpecialNeeds)}
                      />
                    )
                  })}
                </div>
                {SPECIAL_NEEDS.length > 20 && (
                  <ShowMoreButton
                    isExpanded={showAllSpecialNeeds}
                    onToggle={() => setShowAllSpecialNeeds(!showAllSpecialNeeds)}
                  />
                )}
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-white shadow-[0_-24px_16px_-2px_rgba(255,255,255,0.8)] dark:bg-gray-900 dark:shadow-[0_-24px_16px_-2px_rgba(17,24,39,0.8)] border-t border-gray-200 dark:border-gray-700 mt-6">
          <div className="flex p-4 px-8">
            {isModified && (
              <Button
                variant="bordered"
                size="lg"
                radius="full"
                onPress={handleRevert}
                isDisabled={isSaving}
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
                className="px-8"
              >
                Cancel
              </Button>
              {(() => {
                const canSave = isModified && !isSaving
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
                    {isSaving ? 'Saving...' : 'Save Preferences'}
                  </Button>
                )
              })()}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
