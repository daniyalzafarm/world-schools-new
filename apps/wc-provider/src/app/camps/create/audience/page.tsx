'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCampsStore } from '../../../../stores/camps-store'
import type { AgeGroup, Gender, UpdateCampAudienceDto } from '../../../../types/camps'
import { Input, LanguageChip, RadioButton } from '@world-schools/ui-web'
import { Button } from '@heroui/react'
import { Trash2 } from 'lucide-react'

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
  const [localHasUnsavedChanges, setLocalHasUnsavedChanges] = useState(false)

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
      setLocalHasUnsavedChanges(false)
      router.push(`/camps/create/programs?id=${campId}`)
    } catch (error) {
      console.error('Failed to save audience:', error)
    }
  }

  // Track when form data changes (to enable "Save & Continue" button)
  useEffect(() => {
    if (wizardCamp) {
      // Check if any field has changed from the original wizardCamp data
      const hasChanges =
        JSON.stringify(formData.ageGroups) !== JSON.stringify(wizardCamp.ageGroups) ||
        JSON.stringify(formData.languages) !== JSON.stringify(wizardCamp.languages) ||
        formData.gender !== wizardCamp.gender

      setLocalHasUnsavedChanges(hasChanges)
    }
  }, [formData, wizardCamp])

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
      hasUnsavedChanges: localHasUnsavedChanges,
    })
  }, [formData, campId, localHasUnsavedChanges])

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
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Who can attend your camp?</h1>
        <p className="text-base leading-normal text-default-500">
          Define age groups, languages, and gender to help parents find your camp
        </p>
      </div>

      <form className="flex flex-col gap-4">
        {/* Age Groups */}
        <div className="form-group">
          <label className="text-base font-medium text-foreground">
            Age Groups <span className="text-danger">*</span>
          </label>
          <div className="mb-2 text-sm leading-normal text-default-500">
            Add one group if all ages are together, or multiple groups if you separate by age
          </div>
          <div className="flex flex-col gap-2">
            {formData.ageGroups.map((ageGroup, index) => (
              <div key={index} className="flex items-center gap-3">
                <Input
                  type="number"
                  placeholder="Min age"
                  min={4}
                  max={18}
                  value={ageGroup.min.toString()}
                  onChange={e => handleAgeGroupChange(index, 'min', e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Max age"
                  min={4}
                  max={18}
                  value={ageGroup.max.toString()}
                  onChange={e => handleAgeGroupChange(index, 'max', e.target.value)}
                />
                {formData.ageGroups.length != 1 && (
                  <Button
                    onPress={() => handleRemoveAgeGroup(index)}
                    isIconOnly
                    variant="light"
                    color="danger"
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button
            onPress={handleAddAgeGroup}
            size="md"
            variant="bordered"
            className="mt-3 w-full border-dashed"
          >
            + Add age group
          </Button>
        </div>

        {/* Languages */}
        <div className="form-group">
          <label className="text-base font-medium text-foreground">
            Main Languages <span className="text-danger">*</span>
          </label>
          <div className="mb-2 text-sm leading-normal text-default-500">
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
          <label className="text-base font-medium text-foreground">
            Gender <span className="text-danger">*</span>
          </label>
          <div className="mt-2 flex gap-3">
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
