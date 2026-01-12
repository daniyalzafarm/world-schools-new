'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardBody, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'

export default function LocationCampusEditorPage() {
  const params = useParams()
  const _campId = params.id as string

  const { currentCamp, updateSection: _updateSection, setHasUnsavedChanges } = useCampsStore()
  const [locationCampus, setLocationCampus] = useState('')

  useEffect(() => {
    if (currentCamp?.campusFacilities?.description) {
      setLocationCampus(currentCamp.campusFacilities.description)
    }
  }, [currentCamp])

  const handleChange = (value: string) => {
    setLocationCampus(value)
    setHasUnsavedChanges(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Location & Campus</h1>
        <p className="text-sm text-gray-600">Describe the camp location and campus facilities</p>
      </div>

      <Card>
        <CardBody>
          <Textarea
            label="Location & Campus"
            placeholder="Describe the camp location, campus facilities, grounds, and amenities"
            value={locationCampus}
            onValueChange={handleChange}
            minRows={8}
            description="Include details about the setting, facilities, and nearby attractions"
          />
        </CardBody>
      </Card>
    </div>
  )
}
