'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Accordion, AccordionItem, Button, Chip, Progress } from '@heroui/react'
import { BadgeCheck, ChevronLeft } from 'lucide-react'

import {
  Autocomplete,
  ChipButton,
  Input,
  RangeSlider,
  SelectField,
  Textarea,
} from "@world-schools/ui-web"

import {
  CURRICULUM_OPTIONS,
  GRADE_LEVEL_OPTIONS,
  type School,
  SCHOOL_FACILITY_OPTIONS,
  SCHOOL_LOCATION_SUGGESTIONS,
  SCHOOL_SPECIAL_NEEDS_OPTIONS,
  SCHOOL_STATUS_OPTIONS,
  SCHOOL_TYPE_OPTIONS,
} from '@/types/school'

import { useSchoolsStore } from '@/stores/schools-store'

interface SchoolFormProps {
  schoolId: string
}

const MIN_FEE = 0
const MAX_FEE = 100000

export const SchoolForm: React.FC<SchoolFormProps> = ({ schoolId }) => {
  const router = useRouter()
  const {
    getSchoolById,
    addSchool,
    updateSchool,
    getBasicInfoProgress,
    getAcademicsProgress,
    getFeesProgress,
    getFacilitiesProgress,
    getOverallProgress,
  } = useSchoolsStore()

  const isNew = schoolId === 'new'
  const existing = isNew ? null : getSchoolById(schoolId)

  // Form state
  const [initialFormData, setInitialFormData] = useState<
    Omit<School, 'id' | 'createdAt' | 'updatedAt'>
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
      locations: [],
      schoolTypes: [],
      curriculum: [],
      gradeLevels: [],
      feeRange: [MIN_FEE, MAX_FEE],
      facilities: [],
      specialNeeds: [],
      enrolled: 0,
    }
  })

  const [formData, setFormData] = useState<Omit<School, 'id' | 'createdAt' | 'updatedAt'>>(
    () => initialFormData
  )

  // UI helpers
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [query, setQuery] = useState('')
  const [showAllCurriculum, setShowAllCurriculum] = useState(false)
  const [showAllGrades, setShowAllGrades] = useState(false)
  const [showAllFacilities, setShowAllFacilities] = useState(false)
  const [showAllSpecialNeeds, setShowAllSpecialNeeds] = useState(false)

  // Update when existing changes
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
        locations: [],
        schoolTypes: [],
        curriculum: [],
        gradeLevels: [],
        feeRange: [MIN_FEE, MAX_FEE] as [number, number],
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
  const current: School = {
    ...(formData as any),
    id: schoolId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const _basicProgress = getBasicInfoProgress(current)
  const _academicsProgress = getAcademicsProgress(current)
  const _feesProgress = getFeesProgress(current)
  const _facilitiesProgress = getFacilitiesProgress(current)
  const overallProgress = getOverallProgress(current)

  const filteredSuggestions = useMemo(() => {
    if (!query) return SCHOOL_LOCATION_SUGGESTIONS
    return SCHOOL_LOCATION_SUGGESTIONS.filter(loc =>
      loc.toLowerCase().includes(query.toLowerCase())
    )
  }, [query])

  // Validation
  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!formData.name.trim()) next.name = 'School name is required'
    if (!formData.capacity || formData.capacity <= 0)
      next.capacity = 'Capacity must be greater than 0'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // Handlers
  const updateField = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const toggleFromArray = (
    key: 'locations' | 'schoolTypes' | 'curriculum' | 'gradeLevels' | 'facilities' | 'specialNeeds',
    value: string
  ) => {
    setFormData(prev => {
      const set = new Set(prev[key])
      if (set.has(value)) set.delete(value)
      else set.add(value)
      return { ...prev, [key]: Array.from(set) as any }
    })
  }

  const handleLocationSelect = (location: string) => {
    if (!location.trim()) return
    if (!formData.locations.includes(location)) {
      updateField('locations', [...formData.locations, location])
    }
    setQuery('')
  }

  const handleSave = async () => {
    if (!validate()) return
    setIsSaving(true)
    try {
      if (isNew) {
        addSchool(formData)
      } else {
        updateSchool(schoolId, formData)
      }
      router.push('/admin/settings/schools')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRevert = () => {
    setFormData(initialFormData)
    setErrors({})
  }

  const handleCancel = () => {
    router.push('/admin/settings/schools')
  }

  const isFeeInvalid = formData.feeRange[0] > formData.feeRange[1]

  const pageTitle = isNew ? 'Add a school' : existing?.name || 'Edit school'

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
                  label="School Name"
                  labelPlacement="outside"
                  isRequired
                  value={formData.name}
                  onValueChange={v => updateField('name', v)}
                  placeholder="Enter school name"
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
                    options={SCHOOL_STATUS_OPTIONS.map(s => s.label)}
                    placeholder="Select status"
                    label="School status"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Capacity
                  </label>
                  <Input
                    value={String(formData.capacity)}
                    onValueChange={v => updateField('capacity', parseInt(v) || 0)}
                    placeholder="Maximum number of students"
                    type="number"
                    className="w-full"
                    isInvalid={!!errors.capacity}
                    errorMessage={errors.capacity}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <Textarea
                  value={formData.description || ''}
                  onValueChange={v => updateField('description', v)}
                  placeholder="Describe the school and its programs"
                  className="w-full"
                  minRows={3}
                />
              </div>

              {/* Academics */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
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
                  Type of School
                </h3>
                <div className="flex flex-wrap gap-2">
                  {SCHOOL_TYPE_OPTIONS.map(opt => {
                    const isSelected = formData.schoolTypes.includes(opt.id)
                    return (
                      <ChipButton
                        key={opt.id}
                        label={opt.label}
                        selected={isSelected}
                        onPress={() => toggleFromArray('schoolTypes', opt.id)}
                      />
                    )
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Curriculum
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(showAllCurriculum ? CURRICULUM_OPTIONS : CURRICULUM_OPTIONS.slice(0, 20)).map(
                    opt => {
                      const isSelected = formData.curriculum.includes(opt.id)
                      return (
                        <ChipButton
                          key={opt.id}
                          label={opt.label}
                          selected={isSelected}
                          onPress={() => toggleFromArray('curriculum', opt.id)}
                        />
                      )
                    }
                  )}
                </div>
                {CURRICULUM_OPTIONS.length > 20 && (
                  <Button
                    variant="light"
                    size="sm"
                    onPress={() => setShowAllCurriculum(!showAllCurriculum)}
                    className="mt-2"
                  >
                    {showAllCurriculum ? 'Show less' : 'Show more'}
                  </Button>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Grade-level
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(showAllGrades ? GRADE_LEVEL_OPTIONS : GRADE_LEVEL_OPTIONS.slice(0, 20)).map(
                    opt => {
                      const isSelected = formData.gradeLevels.includes(opt.id)
                      return (
                        <ChipButton
                          key={opt.id}
                          label={opt.label}
                          selected={isSelected}
                          onPress={() => toggleFromArray('gradeLevels', opt.id)}
                        />
                      )
                    }
                  )}
                </div>
                {GRADE_LEVEL_OPTIONS.length > 20 && (
                  <Button
                    variant="light"
                    size="sm"
                    onPress={() => setShowAllGrades(!showAllGrades)}
                    className="mt-2"
                  >
                    {showAllGrades ? 'Show less' : 'Show more'}
                  </Button>
                )}
              </div>

              {/* Yearly Tuition Fee */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Yearly tuition fee
                </h3>
                <div className="mb-2">
                  <RangeSlider
                    min={MIN_FEE}
                    max={MAX_FEE}
                    step={1000}
                    values={formData.feeRange}
                    onChange={vals => {
                      updateField('feeRange', vals as [number, number])
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Min
                    </label>
                    <Input
                      value={String(formData.feeRange[0])}
                      onValueChange={val => {
                        const num = parseInt(val) || 0
                        if (num <= formData.feeRange[1])
                          updateField('feeRange', [num, formData.feeRange[1]])
                      }}
                      startContent="$"
                      placeholder="0"
                      classNames={{ inputWrapper: isFeeInvalid ? 'border-red-500' : '' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max
                    </label>
                    <Input
                      value={String(formData.feeRange[1])}
                      onValueChange={val => {
                        const num = parseInt(val) || 0
                        if (num >= formData.feeRange[0])
                          updateField('feeRange', [formData.feeRange[0], num])
                      }}
                      startContent="$"
                      placeholder="100000"
                      classNames={{ inputWrapper: isFeeInvalid ? 'border-red-500' : '' }}
                    />
                  </div>
                </div>
                {isFeeInvalid && (
                  <p className="text-red-500 text-sm">
                    Minimum fee cannot be greater than maximum fee
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
                {(showAllFacilities
                  ? SCHOOL_FACILITY_OPTIONS
                  : SCHOOL_FACILITY_OPTIONS.slice(0, 20)
                ).map(facility => {
                  const isSelected = formData.facilities.includes(facility)
                  return (
                    <ChipButton
                      key={facility}
                      label={facility}
                      selected={isSelected}
                      onPress={() => toggleFromArray('facilities', facility)}
                    />
                  )
                })}
              </div>
              {SCHOOL_FACILITY_OPTIONS.length > 20 && (
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
                  ? SCHOOL_SPECIAL_NEEDS_OPTIONS
                  : SCHOOL_SPECIAL_NEEDS_OPTIONS.slice(0, 20)
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
              {SCHOOL_SPECIAL_NEEDS_OPTIONS.length > 20 && (
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
              const canSave = isModified && !isSaving && !isFeeInvalid
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
                  {isSaving ? 'Saving...' : isNew ? 'Add School' : 'Save Changes'}
                </Button>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
