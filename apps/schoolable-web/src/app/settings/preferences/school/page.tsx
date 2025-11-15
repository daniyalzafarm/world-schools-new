'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Accordion, AccordionItem, Button, Chip, Progress } from '@heroui/react'
import { Autocomplete, ChipButton, Input, RangeSlider, ShowMoreButton } from '@world-schools/ui-web'
import { BadgeCheck, ChevronLeft } from 'lucide-react'
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

const MIN_FEE = 0
const MAX_FEE = 100000

const SCHOOL_TYPES = [
  { id: 'international', label: 'International' },
  { id: 'boarding', label: 'Boarding' },
  { id: 'online', label: 'Online' },
]

const CURRICULUM_OPTIONS = [
  { id: 'us', label: 'US' },
  { id: 'ib', label: 'IB' },
  { id: 'uk', label: 'UK' },
  { id: 'french', label: 'French' },
  { id: 'german', label: 'German' },
  { id: 'canadian', label: 'Canadian' },
  { id: 'australian', label: 'Australian' },
  { id: 'indian', label: 'Indian' },
]

const GRADE_LEVELS = [
  { id: 'nursery', label: 'Nursery' },
  { id: 'preschool', label: 'Preschool' },
  { id: 'kindergarten', label: 'Kindergarten' },
  { id: 'elementary', label: 'Elementary' },
  { id: 'primary', label: 'Primary' },
  { id: 'middle', label: 'Middle School' },
  { id: 'high', label: 'High School' },
]

const FACILITIES = [
  'Swimming Pool',
  'Sports Complex',
  'Science Labs',
  'Computer Labs',
  'Library',
  'Auditorium',
  'Cafeteria',
  'Music Room',
  'Art Studio',
  'Playground',
]

const SPECIAL_NEEDS = [
  'Learning Disabilities',
  'Physical Disabilities',
  'Gifted Programs',
  'Language Support',
  'Behavioral Support',
  'Autism Support',
  'ADHD Support',
  'Speech Therapy',
  'Occupational Therapy',
]

export default function SchoolPreferencesPage() {
  const router = useRouter()

  // Location state
  const [query, setQuery] = useState('')
  const [locations, setLocations] = useState<string[]>(['Ohio', 'Texas'])

  // School type state
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(['international']))

  // Curriculum state
  const [selectedCurriculum, setSelectedCurriculum] = useState<Set<string>>(new Set())
  const [showAllCurriculum, setShowAllCurriculum] = useState(false)

  // Grade level state
  const [selectedGrades, setSelectedGrades] = useState<Set<string>>(new Set())
  const [showAllGrades, setShowAllGrades] = useState(false)

  // Tuition fee state
  const [feeRange, setFeeRange] = useState<[number, number]>([10000, 50000])
  const [minFeeText, setMinFeeText] = useState<string>(String(feeRange[0]))
  const [maxFeeText, setMaxFeeText] = useState<string>(String(feeRange[1]))

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
    selectedTypes: new Set(selectedTypes),
    selectedCurriculum: new Set(selectedCurriculum),
    selectedGrades: new Set(selectedGrades),
    feeRange: [...feeRange] as [number, number],
    selectedFacilities: new Set(selectedFacilities),
    selectedSpecialNeeds: new Set(selectedSpecialNeeds),
  }))

  const currentSnapshot = useMemo(
    () => ({
      locations,
      selectedTypes,
      selectedCurriculum,
      selectedGrades,
      feeRange,
      selectedFacilities,
      selectedSpecialNeeds,
    }),
    [
      locations,
      selectedTypes,
      selectedCurriculum,
      selectedGrades,
      feeRange,
      selectedFacilities,
      selectedSpecialNeeds,
    ]
  )

  const isModified = useMemo(() => {
    // Convert Sets to arrays for stable comparison
    const normalize = (snap: any) => ({
      locations: snap.locations,
      selectedTypes: Array.from(snap.selectedTypes),
      selectedCurriculum: Array.from(snap.selectedCurriculum),
      selectedGrades: Array.from(snap.selectedGrades),
      feeRange: snap.feeRange,
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
  const typeProgress = selectedTypes.size > 0 ? 100 : 0
  const curriculumProgress = selectedCurriculum.size > 0 ? 100 : 0
  const gradeProgress = selectedGrades.size > 0 ? 100 : 0
  const feeProgress = feeRange[0] > 0 || feeRange[1] < MAX_FEE ? 100 : 0
  const facilityProgress = selectedFacilities.size > 0 ? 100 : 0
  const specialNeedsProgress = selectedSpecialNeeds.size > 0 ? 100 : 0

  const overallProgress = Math.round(
    (locationProgress +
      typeProgress +
      curriculumProgress +
      gradeProgress +
      feeProgress +
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

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const _payload = {
        locations,
        types: Array.from(selectedTypes),
        curriculum: Array.from(selectedCurriculum),
        grades: Array.from(selectedGrades),
        feeRange,
        facilities: Array.from(selectedFacilities),
        specialNeeds: Array.from(selectedSpecialNeeds),
      }
      // console.warn('School Preferences:', payload)
      router.back()
    } catch (error) {
      console.error('Error saving school preferences:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    router.back()
  }

  const handleRevert = () => {
    setLocations([...initialSnapshot.locations])
    setSelectedTypes(new Set(initialSnapshot.selectedTypes))
    setSelectedCurriculum(new Set(initialSnapshot.selectedCurriculum))
    setSelectedGrades(new Set(initialSnapshot.selectedGrades))
    setFeeRange([...initialSnapshot.feeRange] as [number, number])
    setMinFeeText(String(initialSnapshot.feeRange[0]))
    setMaxFeeText(String(initialSnapshot.feeRange[1]))
    setSelectedFacilities(new Set(initialSnapshot.selectedFacilities))
    setSelectedSpecialNeeds(new Set(initialSnapshot.selectedSpecialNeeds))
    setErrors({})
  }

  const isFeeInvalid = feeRange[0] > feeRange[1]

  return (
    <ProtectedRoute requireAuth={true} requireUser={true}>
      <div className="min-h-full flex flex-col bg-white dark:bg-gray-900">
        {/* Sticky Page Header */}
        <div className="sticky top-0 z-30 bg-white shadow-[0_24px_16px_-2px_rgba(255,255,255,0.8)] dark:bg-gray-900 dark:shadow-[0_24px_16px_-2px_rgba(17,24,39,0.8)] mb-6">
          <div className="h-20 px-10 mb-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-700/50">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                School Preferences
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
            {/* General, Facilities & Special Needs (Collapsible) */}
            <Accordion
              selectionMode="multiple"
              defaultExpandedKeys={['general', 'facilities', 'special']}
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
                  {/* Where */}
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

                  {/* Type of School */}
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      Type of School
                    </h3>
                    <div className="flex flex-wrap">
                      {SCHOOL_TYPES.map(opt => {
                        const isSelected = selectedTypes.has(opt.id)
                        return (
                          <ChipButton
                            key={opt.id}
                            label={opt.label}
                            selected={isSelected}
                            onPress={() => toggleSelection(opt.id, setSelectedTypes)}
                          />
                        )
                      })}
                    </div>
                  </div>

                  {/* Curriculum */}
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      Curriculum
                    </h3>
                    <div className="flex flex-wrap">
                      {(showAllCurriculum
                        ? CURRICULUM_OPTIONS
                        : CURRICULUM_OPTIONS.slice(0, 20)
                      ).map(opt => {
                        const isSelected = selectedCurriculum.has(opt.id)
                        return (
                          <ChipButton
                            key={opt.id}
                            label={opt.label}
                            selected={isSelected}
                            onPress={() => toggleSelection(opt.id, setSelectedCurriculum)}
                          />
                        )
                      })}
                    </div>
                    {CURRICULUM_OPTIONS.length > 20 && (
                      <ShowMoreButton
                        isExpanded={showAllCurriculum}
                        onToggle={() => setShowAllCurriculum(!showAllCurriculum)}
                      />
                    )}
                  </div>

                  {/* Grade Level */}
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      Grade-level
                    </h3>
                    <div className="flex flex-wrap">
                      {(showAllGrades ? GRADE_LEVELS : GRADE_LEVELS.slice(0, 20)).map(opt => {
                        const isSelected = selectedGrades.has(opt.id)
                        return (
                          <ChipButton
                            key={opt.id}
                            label={opt.label}
                            selected={isSelected}
                            onPress={() => toggleSelection(opt.id, setSelectedGrades)}
                          />
                        )
                      })}
                    </div>
                    {GRADE_LEVELS.length > 20 && (
                      <ShowMoreButton
                        isExpanded={showAllGrades}
                        onToggle={() => setShowAllGrades(!showAllGrades)}
                      />
                    )}
                  </div>

                  {/* Yearly Tuition Fee */}
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      Yearly tuition fee
                    </h3>
                    <div className="mb-6">
                      <RangeSlider
                        min={MIN_FEE}
                        max={MAX_FEE}
                        step={1000}
                        values={feeRange}
                        onChange={vals => {
                          setFeeRange(vals)
                          setMinFeeText(String(vals[0]))
                          setMaxFeeText(String(vals[1]))
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Min
                        </label>
                        <Input
                          value={minFeeText}
                          onValueChange={value => {
                            setMinFeeText(value)
                            const num = parseInt(value) || 0
                            if (num <= feeRange[1]) {
                              setFeeRange([num, feeRange[1]])
                            }
                          }}
                          startContent="$"
                          placeholder="0"
                          classNames={{
                            inputWrapper: isFeeInvalid ? 'border-red-500' : 'border-gray-200',
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Max
                        </label>
                        <Input
                          value={maxFeeText}
                          onValueChange={value => {
                            setMaxFeeText(value)
                            const num = parseInt(value) || 0
                            if (num >= feeRange[0]) {
                              setFeeRange([feeRange[0], num])
                            }
                          }}
                          startContent="$"
                          placeholder="100000"
                          classNames={{
                            inputWrapper: isFeeInvalid ? 'border-red-500' : 'border-gray-200',
                          }}
                        />
                      </div>
                    </div>
                    {isFeeInvalid && (
                      <p className="text-red-500 text-sm mt-2">
                        Minimum fee cannot be greater than maximum fee
                      </p>
                    )}
                  </div>
                </div>
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
