'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCampsStore } from '../../../../stores/camps-store'
import { ProgramsForm, type ProgramsFormData } from '../../../../components/camp-forms/ProgramsForm'

export default function ProgramsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campId = searchParams.get('id')

  const { updateCampPrograms, fetchCamp, wizardCamp, setWizardCamp, setWizardStep } =
    useCampsStore()

  const [formData, setFormData] = useState<ProgramsFormData>({
    activities: [],
  })
  const [localHasUnsavedChanges, setLocalHasUnsavedChanges] = useState(false)

  useEffect(() => {
    const init = async () => {
      setWizardStep(3)
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
      // Load saved data if it exists, otherwise keep empty array
      setFormData({
        activities:
          wizardCamp.activities && wizardCamp.activities.length > 0 ? wizardCamp.activities : [],
      })
    }
  }, [wizardCamp])

  const handleSubmit = async () => {
    if (!campId) return
    await updateCampPrograms(campId, formData)
    if (!useCampsStore.getState().error) {
      setLocalHasUnsavedChanges(false)
    }
  }

  // Track when form data changes (to enable "Save & Continue" button)
  useEffect(() => {
    if (wizardCamp) {
      // Check if activities have changed from the original wizardCamp data
      const hasChanges =
        JSON.stringify(formData.activities.sort()) !==
        JSON.stringify((wizardCamp.activities || []).sort())

      setLocalHasUnsavedChanges(hasChanges)
    }
  }, [formData, wizardCamp])

  // Expose form validation and submit handler to parent layout
  useEffect(() => {
    const isFormValid = formData.activities.length > 0

    useCampsStore.setState({
      wizardFormValid: isFormValid,
      wizardFormSubmit: handleSubmit,
      hasUnsavedChanges: localHasUnsavedChanges,
    })
  }, [formData, campId, localHasUnsavedChanges])

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">
          What programs do you offer?
        </h1>
        <p className="text-base leading-normal text-default-500">
          Select all activity categories available at your camp
        </p>
      </div>

      {/* Form */}
      <ProgramsForm
        formData={formData}
        onChange={data => {
          setFormData({ ...formData, ...data })
          setLocalHasUnsavedChanges(true)
        }}
      />
    </div>
  )
}
