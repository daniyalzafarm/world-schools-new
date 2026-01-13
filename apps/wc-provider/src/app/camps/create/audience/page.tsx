'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCampsStore } from '../../../../stores/camps-store'
import type { AgeGroup, Gender, UpdateCampAudienceDto } from '../../../../types/camps'
import { LanguageChip, RadioButton } from '@world-schools/ui-web'

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

export default function AudiencePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campId = searchParams.get('id')

  const { updateCampAudience, fetchCamp, wizardCamp, setWizardCamp, setWizardStep, isLoading } =
    useCampsStore()

  const [formData, setFormData] = useState<UpdateCampAudienceDto>({
    ageGroups: [{ min: 6, max: 12 }],
    languages: ['english'],
    gender: 'coed',
  })

  useEffect(() => {
    setWizardStep(2)

    if (campId) {
      fetchCamp(campId)
        .then(() => {
          // Get the fetched camp from currentCamp and set it as wizardCamp
          const currentCamp = useCampsStore.getState().currentCamp
          if (currentCamp) {
            setWizardCamp(currentCamp)
          }
        })
        .catch(error => {
          console.error('Failed to fetch camp:', error)
          router.push('/camps/create/basic-info')
        })
    } else {
      router.push('/camps/create/basic-info')
    }
  }, [campId, fetchCamp, setWizardCamp, setWizardStep, router])

  useEffect(() => {
    if (wizardCamp) {
      // Load saved data if it exists, otherwise keep defaults
      setFormData({
        ageGroups:
          wizardCamp.ageGroups && wizardCamp.ageGroups.length > 0
            ? (wizardCamp.ageGroups as AgeGroup[])
            : [{ min: 6, max: 12 }],
        languages:
          wizardCamp.languages && wizardCamp.languages.length > 0
            ? wizardCamp.languages
            : ['english'],
        gender: wizardCamp.gender || 'coed',
      })
    }
  }, [wizardCamp])

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

  const handleSubmit = async () => {
    if (!campId) return

    try {
      await updateCampAudience(campId, formData)
      router.push(`/camps/create/programs?id=${campId}`)
    } catch (error) {
      console.error('Failed to save audience:', error)
    }
  }

  // Expose form validation and submit handler to parent layout
  useEffect(() => {
    const isFormValid =
      formData.ageGroups.length > 0 &&
      formData.languages.length > 0 &&
      !!formData.gender &&
      formData.ageGroups.every(ag => ag.min >= 4 && ag.max <= 18 && ag.max > ag.min)

    useCampsStore.setState({
      wizardFormValid: isFormValid,
      wizardFormSubmit: handleSubmit,
    })
  }, [formData, campId])

  const toggleLanguage = (value: string) => {
    const newLanguages = formData.languages.includes(value)
      ? formData.languages.filter(lang => lang !== value)
      : [...formData.languages, value]
    setFormData({ ...formData, languages: newLanguages })
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-1.5 text-[24px] font-semibold text-foreground">
          Who can attend your camp?
        </h1>
        <p className="text-[15px] leading-normal text-default-500">
          Define age groups, languages, and gender to help parents find your camp
        </p>
      </div>

      <form className="space-y-8">
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
                <button
                  type="button"
                  onClick={() => handleRemoveAgeGroup(index)}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-default-200 bg-background text-xl font-semibold text-default-500 transition-all hover:border-danger hover:bg-danger-50 hover:text-danger"
                  style={{
                    visibility: formData.ageGroups.length === 1 ? 'hidden' : 'visible',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddAgeGroup}
            className="mt-3 w-full rounded-lg border-[1.5px] border-dashed border-default-200 bg-background px-4 py-2.5 text-sm font-semibold text-default-500 transition-all hover:border-foreground hover:bg-default-50 hover:text-foreground"
          >
            + Add age group
          </button>
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
