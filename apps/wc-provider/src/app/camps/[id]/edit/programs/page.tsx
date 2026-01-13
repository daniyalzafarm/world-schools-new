'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCampsStore } from '../../../../../stores/camps-store'
import type { UpdateCampProgramsDto } from '../../../../../types/camps'
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

export default function ProgramsEditorPage() {
  const router = useRouter()
  const params = useParams()
  const campId = params.id as string

  const { updateCampPrograms, fetchCamp, currentCamp } = useCampsStore()

  const [formData, setFormData] = useState<UpdateCampProgramsDto>({
    activities: [],
  })

  useEffect(() => {
    if (campId) {
      fetchCamp(campId).catch(error => {
        console.error('Failed to fetch camp:', error)
        router.push('/camps')
      })
    }
  }, [campId, fetchCamp, router])

  useEffect(() => {
    if (currentCamp) {
      setFormData({
        activities:
          currentCamp.activities && currentCamp.activities.length > 0 ? currentCamp.activities : [],
      })
    }
  }, [currentCamp])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!campId) return

    try {
      await updateCampPrograms(campId, formData)
      // Refresh the camp data to update the sidebar
      await fetchCamp(campId)
    } catch (error) {
      console.error('Failed to save programs:', error)
    }
  }

  const toggleActivity = (value: string) => {
    const newActivities = formData.activities.includes(value)
      ? formData.activities.filter(act => act !== value)
      : [...formData.activities, value]
    setFormData({ activities: newActivities })
  }

  const isFormValid = formData.activities.length > 0

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

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Activity Categories */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">
              Activity Categories <span className="text-danger">*</span>
            </label>
            <span className="group relative inline-flex cursor-help items-center">
              <span className="text-sm text-default-400">ⓘ</span>
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden w-48 -translate-x-1/2 rounded-lg bg-foreground px-3 py-2 text-xs text-background shadow-lg group-hover:block">
                Select all activity types offered at your camp
              </span>
            </span>
          </div>
          <div className="mb-2.5 text-sm leading-normal text-default-500">
            Choose all that apply - you'll provide details for each category later
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ACTIVITY_OPTIONS.map(activity => (
              <CheckboxButton
                key={activity.value}
                label={activity.label}
                value={activity.value}
                checked={formData.activities.includes(activity.value)}
                onChange={() => toggleActivity(activity.value)}
              />
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isFormValid}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  )
}

