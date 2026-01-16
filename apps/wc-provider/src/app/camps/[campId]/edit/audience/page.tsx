'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCampsStore } from '../../../../../stores/camps-store'
import type { AgeGroup, Gender, UpdateCampAudienceDto } from '../../../../../types/camps'
import { LanguageChip, RadioButton } from '@world-schools/ui-web'
import { Button } from '@heroui/react'
import { Trash, Trash2 } from 'lucide-react'

const LANGUAGE_OPTIONS = [
  { value: 'english', label: 'English' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'italian', label: 'Italian' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'dutch', label: 'Dutch' },
  { value: 'chinese', label: 'Chinese' },
]

export default function AudienceEditorPage() {
  const router = useRouter()
  const params = useParams()
  const campId = params.campId as string

  const {
    updateCampAudience,
    fetchCamp,
    currentCamp,
    isLoading,
    setHasUnsavedChanges,
    setWizardFormValid,
    setWizardFormSubmit,
  } = useCampsStore()

  const [formData, setFormData] = useState<UpdateCampAudienceDto>({
    ageGroups: [{ min: 6, max: 12 }],
    languages: ['english'],
    gender: 'coed',
  })

  const [originalData, setOriginalData] = useState<UpdateCampAudienceDto | null>(null)

  useEffect(() => {
    if (campId) {
      fetchCamp(campId).catch(error => {
        console.error('Failed to fetch camp:', error)
        router.push('/camps')
      })
    }

    // Cleanup on unmount
    return () => {
      setHasUnsavedChanges(false)
      setWizardFormValid(false)
      setWizardFormSubmit(null)
    }
  }, [campId, fetchCamp, router, setHasUnsavedChanges, setWizardFormValid, setWizardFormSubmit])

  useEffect(() => {
    if (currentCamp) {
      const audienceData = {
        ageGroups:
          currentCamp.ageGroups && currentCamp.ageGroups.length > 0
            ? (currentCamp.ageGroups as AgeGroup[])
            : [{ min: 6, max: 12 }],
        languages:
          currentCamp.languages && currentCamp.languages.length > 0
            ? currentCamp.languages
            : ['english'],
        gender: currentCamp.gender || 'coed',
      }
      setFormData(audienceData)
      setOriginalData(audienceData)
    }
  }, [currentCamp])

  // Detect form changes
  useEffect(() => {
    if (!originalData) return

    const hasChanges =
      JSON.stringify(formData.ageGroups) !== JSON.stringify(originalData.ageGroups) ||
      JSON.stringify(formData.languages) !== JSON.stringify(originalData.languages) ||
      formData.gender !== originalData.gender

    setHasUnsavedChanges(hasChanges)
  }, [formData, originalData, setHasUnsavedChanges])

  // Update form validity
  useEffect(() => {
    const isValid =
      formData.ageGroups.length > 0 &&
      formData.languages.length > 0 &&
      formData.gender !== undefined

    setWizardFormValid(isValid)
  }, [formData, setWizardFormValid])

  // Register submit handler
  useEffect(() => {
    const handleFormSubmit = async () => {
      if (!campId) return

      try {
        await updateCampAudience(campId, formData)
        await fetchCamp(campId)
      } catch (error) {
        console.error('Failed to save audience:', error)
        throw error
      }
    }

    setWizardFormSubmit(handleFormSubmit)

    return () => {
      setWizardFormSubmit(null)
    }
  }, [campId, formData, updateCampAudience, fetchCamp, setWizardFormSubmit])

  const handleAddAgeGroup = () => {
    setFormData({
      ...formData,
      ageGroups: [...formData.ageGroups, { min: 6, max: 12 }],
    })
  }

  const handleRemoveAgeGroup = (index: number) => {
    if (formData.ageGroups.length > 1) {
      setFormData({
        ...formData,
        ageGroups: formData.ageGroups.filter((_, i) => i !== index),
      })
    }
  }

  const handleAgeGroupChange = (index: number, field: 'min' | 'max', value: string) => {
    const numValue = parseInt(value) || 0
    const newAgeGroups = [...formData.ageGroups]
    newAgeGroups[index] = { ...newAgeGroups[index], [field]: numValue }
    setFormData({ ...formData, ageGroups: newAgeGroups })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!campId) return

    try {
      await updateCampAudience(campId, formData)
      // Stay on the same page after saving
    } catch (error) {
      console.error('Failed to save audience:', error)
    }
  }

  const toggleLanguage = (value: string) => {
    const newLanguages = formData.languages.includes(value)
      ? formData.languages.filter(lang => lang !== value)
      : [...formData.languages, value]
    setFormData({ ...formData, languages: newLanguages })
  }

  const isFormValid =
    formData.ageGroups.length > 0 &&
    formData.languages.length > 0 &&
    !!formData.gender &&
    formData.ageGroups.every(ag => ag.min >= 4 && ag.max <= 18 && ag.max > ag.min)

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Who can attend your camp?</h1>
        <p className="text-base leading-normal text-default-500">
          Define age groups, languages, and gender to help parents find your camp
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Age Groups */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">
              Age Groups <span className="text-danger">*</span>
            </label>
            <span className="group relative inline-flex cursor-help items-center">
              <span className="text-sm text-default-400">ⓘ</span>
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden w-48 -translate-x-1/2 rounded-lg bg-foreground px-3 py-2 text-xs text-background shadow-lg group-hover:block">
                Define age ranges for your camp programs, rooms, or pricing
              </span>
            </span>
          </div>
          <div className="mb-2.5 text-sm leading-normal text-default-500">
            Add one group if all ages are together, or multiple groups if you separate by age
          </div>
          <div className="space-y-2">
            {formData.ageGroups.map((ageGroup, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-center gap-3">
                <input
                  type="number"
                  placeholder="Min age"
                  min={4}
                  max={18}
                  value={ageGroup.min}
                  onChange={e => handleAgeGroupChange(index, 'min', e.target.value)}
                  className="h-10 rounded-lg border-2 border-default-200 bg-background px-3 text-sm text-foreground transition-colors focus:border-primary focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Max age"
                  min={4}
                  max={18}
                  value={ageGroup.max}
                  onChange={e => handleAgeGroupChange(index, 'max', e.target.value)}
                  className="h-10 rounded-lg border-2 border-default-200 bg-background px-3 text-sm text-foreground transition-colors focus:border-primary focus:outline-none"
                />
                <Button
                  size="sm"
                  color="danger"
                  isIconOnly
                  variant="light"
                  onPress={() => handleRemoveAgeGroup(index)}
                  isDisabled={formData.ageGroups.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            size="md"
            variant="bordered"
            onPress={handleAddAgeGroup}
            className="mt-3 w-full py-2.5 border-dashed"
          >
            + Add age group
          </Button>
        </div>

        {/* Languages */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">
              Main Languages <span className="text-danger">*</span>
            </label>
            <span className="group relative inline-flex cursor-help items-center">
              <span className="text-sm text-default-400">ⓘ</span>
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden w-48 -translate-x-1/2 rounded-lg bg-foreground px-3 py-2 text-xs text-background shadow-lg group-hover:block">
                Select all languages used for activities and communication
              </span>
            </span>
          </div>
          <div className="mb-2.5 text-sm leading-normal text-default-500">
            Select all languages used for activities and communication
          </div>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map(lang => (
              <LanguageChip
                key={lang.value}
                label={lang.label}
                value={lang.value}
                selected={formData.languages.includes(lang.value)}
                onClick={() => toggleLanguage(lang.value)}
              />
            ))}
          </div>
        </div>

        {/* Gender */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">
              Gender <span className="text-danger">*</span>
            </label>
            <span className="group relative inline-flex cursor-help items-center">
              <span className="text-sm text-default-400">ⓘ</span>
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden w-48 -translate-x-1/2 rounded-lg bg-foreground px-3 py-2 text-xs text-background shadow-lg group-hover:block">
                Who can attend your camp
              </span>
            </span>
          </div>
          <div className="mt-2.5 flex gap-3">
            <RadioButton
              id="genderCoed"
              name="gender"
              value="coed"
              label="Coed"
              checked={formData.gender === 'coed'}
              onChange={value => setFormData({ ...formData, gender: value as Gender })}
            />
            <RadioButton
              id="genderBoys"
              name="gender"
              value="boys"
              label="Boys Only"
              checked={formData.gender === 'boys'}
              onChange={value => setFormData({ ...formData, gender: value as Gender })}
            />
            <RadioButton
              id="genderGirls"
              name="gender"
              value="girls"
              label="Girls Only"
              checked={formData.gender === 'girls'}
              onChange={value => setFormData({ ...formData, gender: value as Gender })}
            />
          </div>
        </div>
      </form>
    </div>
  )
}
