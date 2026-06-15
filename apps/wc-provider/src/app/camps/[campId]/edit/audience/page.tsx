'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCampsStore } from '../../../../../stores/camps-store'
import { useAutosave } from '../../../../../hooks/useAutosave'
import type { AgeGroup } from '../../../../../types/camps'
import {
  AudienceForm,
  type AudienceFormData,
} from '../../../../../components/camp-forms/AudienceForm'

export default function AudienceEditorPage() {
  const router = useRouter()
  const params = useParams()
  const campId = params.campId as string

  const { updateCampAudience, fetchCamp, currentCamp } = useCampsStore()

  const [formData, setFormData] = useState<AudienceFormData>({
    ageGroups: [{ min: 6, max: 12 }],
    languages: ['en'],
    gender: 'coed',
  })
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasValidationErrors, setHasValidationErrors] = useState(false)

  useEffect(() => {
    const init = async () => {
      if (!campId) return
      await fetchCamp(campId)
      if (useCampsStore.getState().error) router.push('/camps')
    }
    void init()
  }, [campId, fetchCamp, router])

  useEffect(() => {
    if (currentCamp) {
      setFormData({
        ageGroups:
          currentCamp.ageGroups && currentCamp.ageGroups.length > 0
            ? (currentCamp.ageGroups as AgeGroup[])
            : [{ min: 6, max: 12 }],
        languages:
          currentCamp.languages && currentCamp.languages.length > 0
            ? currentCamp.languages
            : ['en'],
        gender: currentCamp.gender || 'coed',
      })
      setIsLoaded(true)
    }
  }, [currentCamp])

  const autosaveEnabled =
    isLoaded &&
    !hasValidationErrors &&
    formData.ageGroups.length > 0 &&
    formData.languages.length > 0

  useAutosave(formData, {
    enabled: autosaveEnabled,
    save: async data => {
      await updateCampAudience(campId, data)
      if (!useCampsStore.getState().error) {
        await fetchCamp(campId)
      }
    },
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Who can attend your camp?</h1>
        <p className="text-base leading-normal text-default-500">
          Define age groups, languages, and gender to help parents find your camp
        </p>
      </div>

      <AudienceForm
        formData={formData}
        onChange={data => setFormData({ ...formData, ...data })}
        onValidationChange={setHasValidationErrors}
        editContext
      />
    </div>
  )
}
