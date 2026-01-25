'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCampsStore } from '../../../../stores/camps-store'
import type { UpdateCampProgramsDto } from '../../../../types/camps'
import { CheckboxButton } from '@world-schools/ui-web'

const ACTIVITY_OPTIONS = [
  { value: 'sports', label: 'Sports' },
  { value: 'languages', label: 'Languages' },
  { value: 'arts', label: 'Arts & Crafts' },
  { value: 'adventure', label: 'Adventure Activities' },
  { value: 'water', label: 'Water Activities' },
  { value: 'environment', label: 'Environmental Activities' },
  { value: 'academics', label: 'Academics' },
  { value: 'religion', label: 'Religion Programs' },
  { value: 'excursions', label: 'Excursions & Trips' },
]

export default function ProgramsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campId = searchParams.get('id')

  const { updateCampPrograms, fetchCamp, wizardCamp, setWizardCamp, setWizardStep, isLoading } =
    useCampsStore()

  const [formData, setFormData] = useState<UpdateCampProgramsDto>({
    activities: [],
  })
  const [localHasUnsavedChanges, setLocalHasUnsavedChanges] = useState(false)

  useEffect(() => {
    setWizardStep(3)

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
      // Load saved data if it exists, otherwise keep empty array
      setFormData({
        activities:
          wizardCamp.activities && wizardCamp.activities.length > 0 ? wizardCamp.activities : [],
      })
    }
  }, [wizardCamp])

  const handleSubmit = async () => {
    if (!campId) return

    try {
      await updateCampPrograms(campId, formData)
      setLocalHasUnsavedChanges(false)
      router.push(`/camps/create/photos?id=${campId}`)
    } catch (error) {
      console.error('Failed to save programs:', error)
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

  const toggleActivity = (value: string) => {
    const newActivities = formData.activities.includes(value)
      ? formData.activities.filter(act => act !== value)
      : [...formData.activities, value]
    setFormData({ activities: newActivities })
  }

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

      <form className="flex flex-col gap-8">
        <div className="form-group">
          <label className="text-base font-medium text-foreground">
            Activity Categories <span className="text-danger">*</span>
          </label>
          <div className="mb-2 text-sm leading-normal text-default-500">
            Only editors for selected activities will appear in your dashboard
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {ACTIVITY_OPTIONS.map(activity => (
              <CheckboxButton
                key={activity.value}
                id={`act${activity.value}`}
                value={activity.value}
                label={activity.label}
                checked={formData.activities.includes(activity.value)}
                onChange={() => toggleActivity(activity.value)}
              />
            ))}
          </div>
        </div>
      </form>
    </div>
  )
}
