'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCampsStore } from '../../../../../stores/camps-store'
import { useAutosave } from '../../../../../hooks/useAutosave'
import {
  ProgramsForm,
  type ProgramsFormData,
} from '../../../../../components/camp-forms/ProgramsForm'

export default function ProgramsEditorPage() {
  const router = useRouter()
  const params = useParams()
  const campId = params.campId as string

  const { updateCampPrograms, fetchCamp, currentCamp } = useCampsStore()

  const [formData, setFormData] = useState<ProgramsFormData>({
    activities: [],
  })
  const [isLoaded, setIsLoaded] = useState(false)

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
        activities:
          currentCamp.activities && currentCamp.activities.length > 0 ? currentCamp.activities : [],
      })
      setIsLoaded(true)
    }
  }, [currentCamp])

  useAutosave(formData, {
    enabled: isLoaded && formData.activities.length > 0,
    save: async data => {
      await updateCampPrograms(campId, data)
      if (!useCampsStore.getState().error) {
        await fetchCamp(campId)
      }
    },
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">
          What programs do you offer?
        </h1>
        <p className="text-base leading-normal text-default-500">
          Select all activity categories available at your camp
        </p>
      </div>

      <ProgramsForm formData={formData} onChange={data => setFormData({ ...formData, ...data })} />
    </div>
  )
}
