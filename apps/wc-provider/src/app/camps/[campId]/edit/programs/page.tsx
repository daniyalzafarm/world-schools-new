'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCampsStore } from '../../../../../stores/camps-store'
import {
  ProgramsForm,
  type ProgramsFormData,
} from '../../../../../components/camp-forms/ProgramsForm'

export default function ProgramsEditorPage() {
  const router = useRouter()
  const params = useParams()
  const campId = params.campId as string

  const {
    updateCampPrograms,
    fetchCamp,
    currentCamp,
    setHasUnsavedChanges,
    setWizardFormValid,
    setWizardFormSubmit,
  } = useCampsStore()

  const [formData, setFormData] = useState<ProgramsFormData>({
    activities: [],
  })

  const [originalData, setOriginalData] = useState<ProgramsFormData | null>(null)

  useEffect(() => {
    const init = async () => {
      if (!campId) return
      await fetchCamp(campId)
      if (useCampsStore.getState().error) router.push('/camps')
    }
    void init()

    // Cleanup on unmount
    return () => {
      setHasUnsavedChanges(false)
      setWizardFormValid(false)
      setWizardFormSubmit(null)
    }
  }, [campId, fetchCamp, router, setHasUnsavedChanges, setWizardFormValid, setWizardFormSubmit])

  useEffect(() => {
    if (currentCamp) {
      const programsData = {
        activities:
          currentCamp.activities && currentCamp.activities.length > 0 ? currentCamp.activities : [],
      }
      setFormData(programsData)
      setOriginalData(programsData)
    }
  }, [currentCamp])

  // Detect form changes
  useEffect(() => {
    if (!originalData) return

    const hasChanges =
      JSON.stringify(formData.activities.sort()) !== JSON.stringify(originalData.activities.sort())

    setHasUnsavedChanges(hasChanges)
  }, [formData, originalData, setHasUnsavedChanges])

  // Update form validity
  useEffect(() => {
    const isValid = formData.activities.length > 0

    setWizardFormValid(isValid)
  }, [formData, setWizardFormValid])

  // Register submit handler
  useEffect(() => {
    const handleFormSubmit = async () => {
      if (!campId) return
      await updateCampPrograms(campId, formData)
      if (!useCampsStore.getState().error) {
        await fetchCamp(campId)
      }
    }

    setWizardFormSubmit(handleFormSubmit)

    return () => {
      setWizardFormSubmit(null)
    }
  }, [campId, formData, updateCampPrograms, fetchCamp, setWizardFormSubmit])

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
      <ProgramsForm formData={formData} onChange={data => setFormData({ ...formData, ...data })} />
    </div>
  )
}
