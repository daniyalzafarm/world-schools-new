'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCampsStore } from '../../../../stores/camps-store'
import type { AgeGroup } from '../../../../types/camps'
import { AudienceForm, type AudienceFormData } from '../../../../components/camp-forms/AudienceForm'

export default function AudiencePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campId = searchParams.get('id')

  const { updateCampAudience, fetchCamp, wizardCamp, setWizardCamp, setWizardStep } =
    useCampsStore()

  const autoSavedRef = useRef(false)

  const [formData, setFormData] = useState<AudienceFormData>({
    ageGroups: [{ min: 6, max: 12 }],
    languages: ['english'],
    gender: 'coed',
  })
  const [localHasUnsavedChanges, setLocalHasUnsavedChanges] = useState(false)
  const [hasValidationErrors, setHasValidationErrors] = useState(false)

  useEffect(() => {
    const init = async () => {
      setWizardStep(2)
      if (!campId) {
        router.push('/camps/create/basic-info')
        return
      }
      await fetchCamp(campId)
      if (useCampsStore.getState().error) {
        router.push('/camps/create/basic-info')
        return
      }
      const currentCamp = useCampsStore.getState().currentCamp
      if (currentCamp) setWizardCamp(currentCamp)
    }
    void init()
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

  // Auto-save defaults on first visit (camp just created, no audience data yet).
  // On revisits wizardCamp.ageGroups is already populated, so this is skipped.
  useEffect(() => {
    if (!wizardCamp || !campId || autoSavedRef.current) return

    const hasExistingAudienceData =
      wizardCamp.ageGroups &&
      Array.isArray(wizardCamp.ageGroups) &&
      wizardCamp.ageGroups.length > 0 &&
      wizardCamp.languages &&
      wizardCamp.languages.length > 0 &&
      !!wizardCamp.gender

    if (!hasExistingAudienceData) {
      autoSavedRef.current = true
      void updateCampAudience(campId, {
        ageGroups: [{ min: 6, max: 12 }],
        languages: ['english'],
        gender: 'coed',
      }).then(() => {
        if (useCampsStore.getState().error) autoSavedRef.current = false
      })
    }
  }, [wizardCamp, campId, updateCampAudience])

  const handleSubmit = async () => {
    if (!campId) return
    await updateCampAudience(campId, formData)
    if (!useCampsStore.getState().error) {
      setLocalHasUnsavedChanges(false)
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
      !hasValidationErrors

    useCampsStore.setState({
      wizardFormValid: isFormValid,
      wizardFormSubmit: handleSubmit,
      hasUnsavedChanges: localHasUnsavedChanges,
    })
  }, [formData, campId, localHasUnsavedChanges, hasValidationErrors])

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
        onChange={data => {
          setFormData({ ...formData, ...data })
          setLocalHasUnsavedChanges(true)
        }}
        onValidationChange={setHasValidationErrors}
      />
    </div>
  )
}
