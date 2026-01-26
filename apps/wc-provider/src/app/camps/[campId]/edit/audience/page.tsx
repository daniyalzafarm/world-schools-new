'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCampsStore } from '../../../../../stores/camps-store'
import type { AgeGroup } from '../../../../../types/camps'
import {
  AudienceForm,
  type AudienceFormData,
} from '../../../../../components/camp-forms/AudienceForm'

export default function AudienceEditorPage() {
  const router = useRouter()
  const params = useParams()
  const campId = params.campId as string

  const {
    updateCampAudience,
    fetchCamp,
    currentCamp,
    setHasUnsavedChanges,
    setWizardFormValid,
    setWizardFormSubmit,
  } = useCampsStore()

  const [formData, setFormData] = useState<AudienceFormData>({
    ageGroups: [{ min: 6, max: 12 }],
    languages: ['english'],
    gender: 'coed',
  })

  const [originalData, setOriginalData] = useState<AudienceFormData | null>(null)
  const [hasValidationErrors, setHasValidationErrors] = useState(false)

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
      formData.gender !== undefined &&
      !hasValidationErrors

    setWizardFormValid(isValid)
  }, [formData, setWizardFormValid, hasValidationErrors])

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

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Who can attend your camp?</h1>
        <p className="text-base leading-normal text-default-500">
          Define age groups, languages, and gender to help parents find your camp
        </p>
      </div>

      {/* Form */}
      <AudienceForm
        formData={formData}
        onChange={data => setFormData({ ...formData, ...data })}
        onValidationChange={setHasValidationErrors}
      />
    </div>
  )
}
