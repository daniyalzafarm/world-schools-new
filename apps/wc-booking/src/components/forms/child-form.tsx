'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Accordion, AccordionItem, Button, Chip, Progress } from '@heroui/react'
import { BadgeCheck, ChevronLeft } from 'lucide-react'
import { CalendarDate } from '@internationalized/date'

import {
  ChipButton,
  DatePicker,
  Input,
  NationalitySelector,
  SelectField,
  ShowMoreButton,
  Textarea,
} from '@world-schools/ui-web'

import {
  type AcademicPreferences,
  ACTIVITY_OPTIONS,
  type Child,
  createEmptyChild,
  type ExtraCurricular,
  GENDER_OPTIONS,
  getChildDisplayName,
  GRADE_OPTIONS,
  LANGUAGE_OPTIONS,
  LEARNING_STYLES,
  type PersonalInfo,
  SCHEDULE_OPTIONS,
  SPECIAL_NEEDS_AREAS,
  type SpecialNeeds,
  SUBJECT_OPTIONS,
  SUPPORT_NEEDS,
} from '@/types/child'

import { useChildrenStore } from '@/stores/children-store'

interface ChildFormProps {
  childId: string
}

export const ChildForm: React.FC<ChildFormProps> = ({ childId }) => {
  const router = useRouter()
  const {
    children: _children,
    addChild,
    updateChild,
    getChildById,
    getPersonalInfoProgress,
    getAcademicPreferencesProgress,
    getExtraCurricularProgress,
    getSpecialNeedsProgress,
    getOverallProgress,
  } = useChildrenStore()

  const isNewChild = childId === 'new'
  const existingChild = isNewChild ? null : getChildById(childId)

  // Form state
  const [initialFormData, setInitialFormData] = useState<
    Omit<Child, 'id' | 'createdAt' | 'updatedAt'>
  >(() => {
    if (existingChild) {
      return {
        personalInfo: existingChild.personalInfo,
        academicPreferences: existingChild.academicPreferences,
        extraCurricular: existingChild.extraCurricular,
        specialNeeds: existingChild.specialNeeds,
      }
    }
    return createEmptyChild()
  })
  const [formData, setFormData] = useState<Omit<Child, 'id' | 'createdAt' | 'updatedAt'>>(() => {
    if (existingChild) {
      return {
        personalInfo: existingChild.personalInfo,
        academicPreferences: existingChild.academicPreferences,
        extraCurricular: existingChild.extraCurricular,
        specialNeeds: existingChild.specialNeeds,
      }
    }
    return createEmptyChild()
  })

  // Show more states
  const [showAllLanguages, setShowAllLanguages] = useState(false)
  const [showAllSubjects, setShowAllSubjects] = useState(false)
  const [showAllInstructionLanguages, setShowAllInstructionLanguages] = useState(false)
  const [showAllActivities, setShowAllActivities] = useState(false)
  const [showAllAreas, setShowAllAreas] = useState(false)
  const [showAllSupports, setShowAllSupports] = useState(false)

  // Loading and error states
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const pageTitle = isNewChild
    ? 'Add a child'
    : getChildDisplayName(existingChild ?? (formData as Child))

  // Calculate progress for current form data
  const currentChild = { ...formData, id: childId } as Child
  const personalProgress = getPersonalInfoProgress(currentChild)
  const academicProgress = getAcademicPreferencesProgress(currentChild)
  const extraCurricularProgress = getExtraCurricularProgress(currentChild)
  const specialNeedsProgress = getSpecialNeedsProgress(currentChild)
  const overallProgress = getOverallProgress(currentChild)

  // Update form data when existing child changes
  useEffect(() => {
    if (existingChild) {
      const nextData = {
        personalInfo: existingChild.personalInfo,
        academicPreferences: existingChild.academicPreferences,
        extraCurricular: existingChild.extraCurricular,
        specialNeeds: existingChild.specialNeeds,
      }
      setFormData(nextData)
      setInitialFormData(nextData)
    } else {
      const empty = createEmptyChild()
      setFormData(empty)
      setInitialFormData(empty)
    }
  }, [existingChild])

  // Modified state
  const isModified = useMemo(() => {
    try {
      return JSON.stringify(formData) !== JSON.stringify(initialFormData)
    } catch {
      return true
    }
  }, [formData, initialFormData])

  // Helper functions for date conversion
  const convertDateToCalendarDate = (date: Date | string | undefined): CalendarDate | undefined => {
    if (!date) return undefined

    // Convert string to Date if needed
    const dateObj = typeof date === 'string' ? new Date(date) : date

    // Validate that we have a valid Date object
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return undefined
    }

    return new CalendarDate(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate())
  }

  const convertCalendarDateToDate = (calendarDate: any): Date | undefined => {
    if (!calendarDate) return undefined
    return new Date(calendarDate.year, calendarDate.month - 1, calendarDate.day)
  }

  // Form update handlers
  const updatePersonalInfo = (updates: Partial<PersonalInfo>) => {
    setFormData(prev => ({
      ...prev,
      personalInfo: { ...prev.personalInfo, ...updates },
    }))
  }

  const updateAcademicPreferences = (updates: Partial<AcademicPreferences>) => {
    setFormData(prev => ({
      ...prev,
      academicPreferences: { ...prev.academicPreferences, ...updates },
    }))
  }

  const updateExtraCurricular = (updates: Partial<ExtraCurricular>) => {
    setFormData(prev => ({
      ...prev,
      extraCurricular: { ...prev.extraCurricular, ...updates },
    }))
  }

  const updateSpecialNeeds = (updates: Partial<SpecialNeeds>) => {
    setFormData(prev => ({
      ...prev,
      specialNeeds: { ...prev.specialNeeds, ...updates },
    }))
  }

  // Array toggle handlers
  const toggleArrayItem = <T,>(
    array: T[],
    item: T,
    updateFn: (updates: any) => void,
    key: string
  ) => {
    const newArray = array.includes(item) ? array.filter(i => i !== item) : [...array, item]
    updateFn({ [key]: newArray })
  }

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.personalInfo.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }

    if (!formData.personalInfo.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Save handler
  const handleSave = async () => {
    if (!validateForm()) return

    setIsSaving(true)
    try {
      if (isNewChild) {
        addChild(formData).catch(error => {
          console.error('Error adding child:', error)
        })
      } else {
        updateChild(childId, formData).catch(error => {
          console.error('Error updating child:', error)
        })
      }
      router.push('/settings/children')
    } catch (error) {
      console.error('Error saving child:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRevert = () => {
    setFormData(initialFormData)
    setErrors({})
  }

  const handleCancel = () => {
    router.push('/settings/children')
  }

  // Get filtered lists
  const languageList = showAllLanguages ? LANGUAGE_OPTIONS : LANGUAGE_OPTIONS.slice(0, 20)
  const subjectList = showAllSubjects ? SUBJECT_OPTIONS : SUBJECT_OPTIONS.slice(0, 20)
  const instructionLanguageList = showAllInstructionLanguages
    ? LANGUAGE_OPTIONS
    : LANGUAGE_OPTIONS.slice(0, 20)
  const activityList = showAllActivities ? ACTIVITY_OPTIONS : ACTIVITY_OPTIONS.slice(0, 20)
  const areaList = showAllAreas ? SPECIAL_NEEDS_AREAS : SPECIAL_NEEDS_AREAS.slice(0, 20)
  const supportList = showAllSupports ? SUPPORT_NEEDS : SUPPORT_NEEDS.slice(0, 20)

  return (
    <div className="min-h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Sticky Page Header */}
      <div className="sticky top-0 z-30 bg-white shadow-[0_24px_16px_-2px_rgba(255,255,255,0.8)] dark:bg-gray-900 dark:shadow-[0_24px_16px_-2px_rgba(17,24,39,0.8)] mb-6">
        <div className="h-20 px-10 mb-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-700/50">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pageTitle}</h1>
            {!isNewChild && isModified && (
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
                <BadgeCheck size={20} fill="current" className="stroke-white fill-primary-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <Accordion
          selectionMode="multiple"
          defaultExpandedKeys={['personal', 'academic', 'extracurricular', 'special']}
          className="space-y-6"
        >
          {/* Personal Information Section */}
          <AccordionItem
            key="personal"
            title={
              <div className="flex items-center gap-4">
                <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Personal Information
                </span>
                <div className="flex items-center space-x-2">
                  <Progress
                    value={personalProgress}
                    className="w-16"
                    size="md"
                    color="primary"
                    radius="full"
                    showValueLabel={false}
                    classNames={{
                      track: 'bg-gray-200 dark:bg-gray-700',
                      indicator: 'bg-primary',
                    }}
                  />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {Math.round(personalProgress)}%
                  </span>
                  {personalProgress >= 100 && (
                    <BadgeCheck
                      size={20}
                      fill="current"
                      className="stroke-white fill-primary-600"
                    />
                  )}
                </div>
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
            <div className="space-y-6">
              {/* First Name and Last Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="First Name"
                    labelPlacement="outside"
                    isRequired
                    value={formData.personalInfo.firstName}
                    onValueChange={value => updatePersonalInfo({ firstName: value })}
                    placeholder="Enter first name"
                    className="w-full"
                    isInvalid={!!errors.firstName}
                    errorMessage={errors.firstName}
                  />
                  <Input
                    label="Last Name"
                    labelPlacement="outside"
                    isRequired
                    value={formData.personalInfo.lastName}
                    onValueChange={value => updatePersonalInfo({ lastName: value })}
                    placeholder="Enter last name"
                    className="w-full"
                    isInvalid={!!errors.lastName}
                    errorMessage={errors.lastName}
                  />
                </div>

                {/* Date of Birth */}
                <div>
                  <DatePicker
                    showMonthAndYearPickers
                    label="Date of Birth"
                    labelPlacement="outside"
                    placeholderValue={new CalendarDate(2010, 1, 1)}
                    value={convertDateToCalendarDate(formData.personalInfo.dateOfBirth)}
                    onChange={date =>
                      updatePersonalInfo({ dateOfBirth: convertCalendarDateToDate(date) })
                    }
                  />
                </div>
              </div>

              {/* Gender and Nationality */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Gender
                  </label>
                  <SelectField
                    value={formData.personalInfo.gender}
                    onChange={value => updatePersonalInfo({ gender: value as any })}
                    options={GENDER_OPTIONS}
                    placeholder="Select gender"
                    label="Gender"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nationality
                  </label>
                  <NationalitySelector
                    value={formData.personalInfo.nationality}
                    onChange={value => updatePersonalInfo({ nationality: value })}
                    placeholder="Select nationality"
                    label="Nationality"
                  />
                </div>
              </div>

              {/* Languages */}
              <div>
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Languages
                </h3>
                <div className="flex flex-wrap gap-2">
                  {languageList.map(language => {
                    const isSelected = formData.personalInfo.languages.includes(language)
                    return (
                      <ChipButton
                        key={language}
                        label={language}
                        selected={isSelected}
                        onPress={() =>
                          toggleArrayItem(
                            formData.personalInfo.languages,
                            language,
                            updatePersonalInfo,
                            'languages'
                          )
                        }
                      />
                    )
                  })}
                </div>
                {LANGUAGE_OPTIONS.length > 20 && (
                  <ShowMoreButton
                    isExpanded={showAllLanguages}
                    onToggle={() => setShowAllLanguages(!showAllLanguages)}
                  />
                )}
              </div>
            </div>
          </AccordionItem>

          {/* Academic Preferences Section */}
          <AccordionItem
            key="academic"
            title={
              <div className="flex items-center gap-4">
                <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Academic Preferences
                </span>
                <div className="flex items-center space-x-2">
                  <Progress
                    value={academicProgress}
                    className="w-16"
                    size="md"
                    color="primary"
                    radius="full"
                    showValueLabel={false}
                    classNames={{
                      track: 'bg-gray-200 dark:bg-gray-700',
                      indicator: 'bg-primary',
                    }}
                  />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {Math.round(academicProgress)}%
                  </span>
                  {academicProgress >= 100 && (
                    <BadgeCheck
                      size={20}
                      fill="current"
                      className="stroke-white fill-primary-600"
                    />
                  )}
                </div>
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
            <div className="space-y-6">
              {/* Current Grade */}
              <div className="max-w-md">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Grade
                </label>
                <SelectField
                  value={formData.academicPreferences.currentGrade}
                  onChange={value => updateAcademicPreferences({ currentGrade: value })}
                  options={GRADE_OPTIONS}
                  placeholder="Select grade"
                  label="Current Grade"
                />
              </div>

              {/* Favorite Subjects */}
              <div>
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Favorite Subjects
                </h3>
                <div className="flex flex-wrap gap-2">
                  {subjectList.map(subject => {
                    const isSelected =
                      formData.academicPreferences.favoriteSubjects.includes(subject)
                    return (
                      <ChipButton
                        key={subject}
                        label={subject}
                        selected={isSelected}
                        onPress={() =>
                          toggleArrayItem(
                            formData.academicPreferences.favoriteSubjects,
                            subject,
                            updateAcademicPreferences,
                            'favoriteSubjects'
                          )
                        }
                      />
                    )
                  })}
                </div>
                {SUBJECT_OPTIONS.length > 20 && (
                  <ShowMoreButton
                    isExpanded={showAllSubjects}
                    onToggle={() => setShowAllSubjects(!showAllSubjects)}
                  />
                )}
              </div>

              {/* Learning Style */}
              <div>
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Preferred Learning Style
                </h3>
                <div className="flex flex-wrap gap-2">
                  {LEARNING_STYLES.map(style => {
                    const isSelected = formData.academicPreferences.learningStyle === style
                    return (
                      <ChipButton
                        key={style}
                        label={style}
                        selected={isSelected}
                        onPress={() =>
                          updateAcademicPreferences({
                            learningStyle: isSelected ? undefined : style,
                          })
                        }
                      />
                    )
                  })}
                </div>
              </div>

              {/* Languages of Instruction */}
              <div>
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Languages of Instruction
                </h3>
                <div className="flex flex-wrap gap-2">
                  {instructionLanguageList.map(language => {
                    const isSelected =
                      formData.academicPreferences.languagesOfInstruction.includes(language)
                    return (
                      <ChipButton
                        key={language}
                        label={language}
                        selected={isSelected}
                        onPress={() =>
                          toggleArrayItem(
                            formData.academicPreferences.languagesOfInstruction,
                            language,
                            updateAcademicPreferences,
                            'languagesOfInstruction'
                          )
                        }
                      />
                    )
                  })}
                </div>
                {LANGUAGE_OPTIONS.length > 20 && (
                  <ShowMoreButton
                    isExpanded={showAllInstructionLanguages}
                    onToggle={() => setShowAllInstructionLanguages(!showAllInstructionLanguages)}
                  />
                )}
              </div>

              {/* Interested in Boarding */}
              <div>
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Interested in Boarding?
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['Yes', 'No'].map(option => {
                    const isSelected = formData.academicPreferences.interestedInBoarding === option
                    return (
                      <ChipButton
                        key={option}
                        label={option}
                        selected={isSelected}
                        onPress={() =>
                          updateAcademicPreferences({
                            interestedInBoarding: isSelected ? undefined : (option as 'Yes' | 'No'),
                          })
                        }
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          </AccordionItem>

          {/* Extra-Curricular Section */}
          <AccordionItem
            key="extracurricular"
            title={
              <div className="flex items-center gap-4">
                <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Extra-Curricular Activities
                </span>
                <div className="flex items-center space-x-2">
                  <Progress
                    value={extraCurricularProgress}
                    className="w-16"
                    size="md"
                    color="primary"
                    radius="full"
                    showValueLabel={false}
                    classNames={{
                      track: 'bg-gray-200 dark:bg-gray-700',
                      indicator: 'bg-primary',
                    }}
                  />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {Math.round(extraCurricularProgress)}%
                  </span>
                  {extraCurricularProgress >= 100 && (
                    <BadgeCheck
                      size={20}
                      fill="current"
                      className="stroke-white fill-primary-600"
                    />
                  )}
                </div>
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
            <div className="space-y-6">
              {/* Activity Interests */}
              <div>
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Interests
                </h3>
                <div className="flex flex-wrap gap-2">
                  {activityList.map(activity => {
                    const isSelected = formData.extraCurricular.interests.includes(activity)
                    return (
                      <ChipButton
                        key={activity}
                        label={activity}
                        selected={isSelected}
                        onPress={() =>
                          toggleArrayItem(
                            formData.extraCurricular.interests,
                            activity,
                            updateExtraCurricular,
                            'interests'
                          )
                        }
                      />
                    )
                  })}
                </div>
                {ACTIVITY_OPTIONS.length > 20 && (
                  <ShowMoreButton
                    isExpanded={showAllActivities}
                    onToggle={() => setShowAllActivities(!showAllActivities)}
                  />
                )}
              </div>

              {/* Preferred Schedule */}
              <div>
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Preferred Schedule
                </h3>
                <div className="flex flex-wrap gap-2">
                  {SCHEDULE_OPTIONS.map(schedule => {
                    const isSelected = formData.extraCurricular.preferredSchedule === schedule
                    return (
                      <ChipButton
                        key={schedule}
                        label={schedule}
                        selected={isSelected}
                        onPress={() =>
                          updateExtraCurricular({
                            preferredSchedule: isSelected ? undefined : schedule,
                          })
                        }
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          </AccordionItem>

          {/* Special Needs Section */}
          <AccordionItem
            key="special"
            title={
              <div className="flex items-center gap-4">
                <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Special Needs
                </span>
                <div className="flex items-center space-x-2">
                  <Progress
                    value={specialNeedsProgress}
                    className="w-16"
                    size="md"
                    color="primary"
                    radius="full"
                    showValueLabel={false}
                    classNames={{
                      track: 'bg-gray-200 dark:bg-gray-700',
                      indicator: 'bg-primary',
                    }}
                  />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {Math.round(specialNeedsProgress)}%
                  </span>
                  {specialNeedsProgress >= 100 && (
                    <BadgeCheck
                      size={20}
                      fill="current"
                      className="stroke-white fill-primary-600"
                    />
                  )}
                </div>
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
            <div className="space-y-6">
              {/* Areas of Need */}
              <div>
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Areas of Need
                </h3>
                <div className="flex flex-wrap gap-2">
                  {areaList.map(area => {
                    const isSelected = formData.specialNeeds.areas.includes(area)
                    return (
                      <ChipButton
                        key={area}
                        label={area}
                        selected={isSelected}
                        onPress={() =>
                          toggleArrayItem(
                            formData.specialNeeds.areas,
                            area,
                            updateSpecialNeeds,
                            'areas'
                          )
                        }
                      />
                    )
                  })}
                </div>
                {SPECIAL_NEEDS_AREAS.length > 20 && (
                  <ShowMoreButton
                    isExpanded={showAllAreas}
                    onToggle={() => setShowAllAreas(!showAllAreas)}
                  />
                )}
              </div>

              {/* Support Needs */}
              <div>
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Support Needs
                </h3>
                <div className="flex flex-wrap gap-2">
                  {supportList.map(support => {
                    const isSelected = formData.specialNeeds.supportNeeds.includes(support)
                    return (
                      <ChipButton
                        key={support}
                        label={support}
                        selected={isSelected}
                        onPress={() =>
                          toggleArrayItem(
                            formData.specialNeeds.supportNeeds,
                            support,
                            updateSpecialNeeds,
                            'supportNeeds'
                          )
                        }
                      />
                    )
                  })}
                </div>
                {SUPPORT_NEEDS.length > 20 && (
                  <ShowMoreButton
                    isExpanded={showAllSupports}
                    onToggle={() => setShowAllSupports(!showAllSupports)}
                  />
                )}
              </div>

              {/* Additional Notes */}
              <div>
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Additional Notes
                </h3>
                <Textarea
                  value={formData.specialNeeds.additionalNotes || ''}
                  onValueChange={value => updateSpecialNeeds({ additionalNotes: value })}
                  placeholder="Any additional information about special needs or accommodations..."
                  minRows={4}
                />
              </div>
            </div>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 bg-white shadow-[0_-24px_16px_-2px_rgba(255,255,255,0.8)] dark:bg-gray-900 dark:shadow-[0_-24px_16px_-2px_rgba(17,24,39,0.8)] border-t border-gray-200 dark:border-gray-700 mt-6">
        <div className="flex p-4 px-8">
          {!isNewChild && isModified && (
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
                  {isSaving ? 'Saving...' : isNewChild ? 'Add Child' : 'Save Changes'}
                </Button>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
