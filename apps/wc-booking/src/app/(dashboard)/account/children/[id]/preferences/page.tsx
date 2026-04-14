'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { addToast, Divider } from '@heroui/react'
import { IconTagSelectField, RangeSlider, SelectField, TagSelectField } from '@world-schools/ui-web'
import { useChildrenStore } from '@/stores/children-store'
import { useBeforeUnload } from '@/hooks/use-before-unload'
import { useChildDetailContext } from '@/components/children/ChildDetailContext'
import {
  CAMP_SIZE_OPTIONS,
  type CampPreferences,
  ENVIRONMENT_OPTIONS,
  INTEREST_OPTIONS_WITH_EMOJIS,
  LANGUAGE_OPTIONS_WITH_FLAGS,
  VALUES_OPTIONS,
} from '@/types/child'
import { EmojiCard } from '@/components/emoji-card'
import { RadioGroupField } from '@/components/radio-group-field'

interface FormData {
  interests: string[]
  preferredCampTypes: string[]
  campSize: string
  environmentPreferences: string[]
  valuesPreferences: string[]
  maxDistance: number
  preferredAreas: string[]
  budgetMin: number
  budgetMax: number
  currency: string
  preferredDuration: string[]
  languagesSpoken: string[]
  previousCampExperience: string
}

interface FormErrors {
  interests?: string
  preferredCampTypes?: string
  maxDistance?: string
  preferredAreas?: string
  budgetMin?: string
  budgetMax?: string
  currency?: string
  preferredDuration?: string
  languagesSpoken?: string
  previousCampExperience?: string
}

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'AED']

// Currency symbols mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
}

export default function ChildPreferencesPage() {
  const params = useParams()
  const childId = params.id as string

  const { getChildById, updateChild, isLoading } = useChildrenStore()
  const child = getChildById(childId)
  const { setFormState } = useChildDetailContext()

  const [formData, setFormData] = useState<FormData>({
    interests: [],
    preferredCampTypes: [],
    campSize: 'any',
    environmentPreferences: [],
    valuesPreferences: [],
    maxDistance: 50,
    preferredAreas: [],
    budgetMin: 0,
    budgetMax: 5000,
    currency: 'USD',
    preferredDuration: [],
    languagesSpoken: [],
    previousCampExperience: '',
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isModified, setIsModified] = useState(false)

  // Warn before leaving page with unsaved changes
  useBeforeUnload(isModified)

  // Update context when form state changes
  useEffect(() => {
    setFormState({ isModified, isSaving })
  }, [isModified, isSaving, setFormState])

  // Helper function to convert language labels to IDs (for loading from API)
  const convertLanguageLabelsToIds = (languages: string[]): string[] => {
    return languages.map(lang => {
      // Check if it's already an ID (lowercase)
      const existingId = LANGUAGE_OPTIONS_WITH_FLAGS.find(opt => opt.id === lang.toLowerCase())
      if (existingId) return existingId.id

      // Otherwise, find by label (case-insensitive)
      const byLabel = LANGUAGE_OPTIONS_WITH_FLAGS.find(
        opt => opt.label.toLowerCase() === lang.toLowerCase()
      )
      return byLabel ? byLabel.id : lang.toLowerCase()
    })
  }

  // Helper function to convert language IDs to labels (for saving to API)
  const convertLanguageIdsToLabels = (languageIds: string[]): string[] => {
    return languageIds.map(id => {
      const language = LANGUAGE_OPTIONS_WITH_FLAGS.find(opt => opt.id === id)
      return language ? language.label : id
    })
  }

  // Initialize form data from child
  useEffect(() => {
    if (child?.campPreferences) {
      const prefs = child.campPreferences
      setFormData({
        interests: prefs.interests || [],
        preferredCampTypes: prefs.preferredCampTypes || [],
        campSize: prefs.campSize || 'any',
        environmentPreferences: prefs.environmentPreferences ?? [],
        valuesPreferences: prefs.valuesPreferences ?? [],
        maxDistance: prefs.locationPreferences?.maxDistance ?? 50,
        preferredAreas: prefs.locationPreferences?.preferredAreas ?? [],
        budgetMin: prefs.budgetRange?.min ?? 0,
        budgetMax: prefs.budgetRange?.max ?? 5000,
        currency: prefs.budgetRange?.currency || 'USD',
        preferredDuration: prefs.preferredDuration ?? [],
        // Convert language labels to IDs for compatibility with IconTagInput
        languagesSpoken: convertLanguageLabelsToIds(prefs.languagesSpoken ?? []),
        previousCampExperience: prefs.previousCampExperience || '',
      })
    }
  }, [child])

  // Toggle interest selection
  const toggleInterest = (interestId: string) => {
    const newInterests = formData.interests.includes(interestId)
      ? formData.interests.filter(i => i !== interestId)
      : [...formData.interests, interestId]
    handleFieldChange('interests', newInterests)
  }

  // Toggle environment preference
  const toggleEnvironment = (envId: string) => {
    const newEnv = formData.environmentPreferences.includes(envId)
      ? formData.environmentPreferences.filter(e => e !== envId)
      : [...formData.environmentPreferences, envId]
    handleFieldChange('environmentPreferences', newEnv)
  }

  // Toggle values preference
  const toggleValue = (valueId: string) => {
    const newValues = formData.valuesPreferences.includes(valueId)
      ? formData.valuesPreferences.filter(v => v !== valueId)
      : [...formData.valuesPreferences, valueId]
    handleFieldChange('valuesPreferences', newValues)
  }

  // Format currency value
  const formatCurrency = (value: number): string => {
    const symbol = CURRENCY_SYMBOLS[formData.currency] || '$'
    return `${symbol}${value.toLocaleString()}`
  }

  // Handle budget range change
  const handleBudgetChange = (values: [number, number]) => {
    handleFieldChange('budgetMin', values[0])
    handleFieldChange('budgetMax', values[1])
  }

  // Validation
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // Budget validation
    if (formData.budgetMin < 0) {
      newErrors.budgetMin = 'Minimum budget cannot be negative'
    }
    if (formData.budgetMax < 0) {
      newErrors.budgetMax = 'Maximum budget cannot be negative'
    }
    if (formData.budgetMin > formData.budgetMax) {
      newErrors.budgetMin = 'Minimum budget cannot exceed maximum budget'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSaving(true)

    try {
      const campPreferences: CampPreferences = {
        interests: formData.interests,
        preferredCampTypes: formData.preferredCampTypes,
        campSize: formData.campSize !== 'any' ? formData.campSize : undefined,
        environmentPreferences:
          formData.environmentPreferences.length > 0 ? formData.environmentPreferences : undefined,
        valuesPreferences:
          formData.valuesPreferences.length > 0 ? formData.valuesPreferences : undefined,
        locationPreferences: {
          maxDistance: formData.maxDistance,
          preferredAreas: formData.preferredAreas.length > 0 ? formData.preferredAreas : undefined,
        },
        budgetRange: {
          min: formData.budgetMin,
          max: formData.budgetMax,
          currency: formData.currency,
        },
        preferredDuration:
          formData.preferredDuration.length > 0 ? formData.preferredDuration : undefined,
        // Convert language IDs back to labels for API compatibility
        languagesSpoken: convertLanguageIdsToLabels(formData.languagesSpoken),
        previousCampExperience: formData.previousCampExperience.trim() || undefined,
      }

      const success = await updateChild(childId, { campPreferences })

      if (success) {
        addToast({
          title: 'Success',
          description: 'Camp preferences updated successfully',
          color: 'success',
        })
        setIsModified(false)
      } else {
        addToast({
          title: 'Error',
          description: 'Failed to update preferences. Please try again.',
          color: 'danger',
        })
      }
    } catch (error) {
      console.error('Error updating preferences:', error)
      addToast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        color: 'danger',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle field changes
  const handleFieldChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setIsModified(true)
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  // Loading state
  if (isLoading || !child) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading preferences...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Camp Preferences</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Help us find the perfect camps for your child
        </p>
      </div>

      {/* Form */}
      <form id="preferences-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* LOCATION SECTION */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Location</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Where would {child?.firstName || 'your child'} like to go to camp?
            </p>
          </div>

          <TagSelectField
            label="Preferred regions"
            value={formData.preferredAreas}
            onChange={value => handleFieldChange('preferredAreas', value)}
            suggestions={[
              'Switzerland',
              'France',
              'Spain',
              'USA',
              'Germany',
              'UK',
              'Italy',
              'Austria',
            ]}
            placeholder="Add location"
            aria-label="camp-preferences-add-location"
          />
          <IconTagSelectField
            label="Preferred camp languages"
            value={formData.languagesSpoken}
            onChange={value => handleFieldChange('languagesSpoken', value)}
            items={LANGUAGE_OPTIONS_WITH_FLAGS.map(lang => ({
              id: lang.id,
              label: lang.label,
              icon: lang.flag,
            }))}
            placeholder="Add language"
            aria-label="camp-preferences-add-language"
          />
        </div>

        <Divider className="my-4" />

        {/* BUDGET SECTION */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Budget</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Set {child?.firstName || 'your child'}'s budget range for camps
              </p>
            </div>
            {/* Currency selector */}
            <div className="w-24">
              <SelectField
                aria-label="Currency"
                value={formData.currency}
                onChange={value => handleFieldChange('currency', value)}
                options={CURRENCY_OPTIONS}
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-900 dark:text-white">
              Budget range{' '}
              <span className="text-slate-500 dark:text-slate-400 font-normal">(per week)</span>
            </label>

            {/* Current values display */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(formData.budgetMin)}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">min</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(formData.budgetMax)}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">max</span>
              </div>
            </div>

            {/* Range slider */}
            <div className="space-y-2">
              <RangeSlider
                min={0}
                max={10000}
                step={50}
                values={[formData.budgetMin, formData.budgetMax]}
                onChange={handleBudgetChange}
                color="secondary"
              />
              {/* Range labels */}
              <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                <span>{formatCurrency(0)}</span>
                <span>{formatCurrency(10000)}</span>
              </div>
            </div>
          </div>
        </div>

        <Divider className="my-4" />

        {/* CAMP TYPE SECTION DIVIDER */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Camp type</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              What kind of camp experience for {child?.firstName || 'your child'}?
            </p>
          </div>

          {/* Camp Size */}
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
              Camp size
            </label>
            <RadioGroupField
              options={CAMP_SIZE_OPTIONS}
              value={formData.campSize}
              onChange={value => handleFieldChange('campSize', value)}
              name="campSize"
            />
          </div>

          {/* Camp Activities */}
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
              Camp activities
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {INTEREST_OPTIONS_WITH_EMOJIS.map(interest => (
                <EmojiCard
                  key={interest.id}
                  emoji={interest.emoji}
                  label={interest.label}
                  selected={formData.interests.includes(interest.id)}
                  onClick={() => toggleInterest(interest.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <Divider className="my-4" />

        {/* CAMP CULTURE SECTION DIVIDER */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">
              Camp culture
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              What matters most for {child?.firstName || 'your child'}'s camp experience?
            </p>
          </div>

          {/* Environment & Atmosphere */}
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
              Environment & atmosphere
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {ENVIRONMENT_OPTIONS.map(env => (
                <EmojiCard
                  key={env.id}
                  emoji={env.emoji}
                  label={env.label}
                  selected={formData.environmentPreferences.includes(env.id)}
                  onClick={() => toggleEnvironment(env.id)}
                />
              ))}
            </div>
          </div>

          {/* What We Value Most */}
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
              What we value most
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {VALUES_OPTIONS.map(value => (
                <EmojiCard
                  key={value.id}
                  emoji={value.emoji}
                  label={value.label}
                  selected={formData.valuesPreferences.includes(value.id)}
                  onClick={() => toggleValue(value.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
