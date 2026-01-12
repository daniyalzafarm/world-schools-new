'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardBody, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'

export default function AccommodationEditorPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.id as string

  const { currentCamp, updateSection: _updateSection, setHasUnsavedChanges } = useCampsStore()
  const [accommodation, setAccommodation] = useState('')

  useEffect(() => {
    // Redirect if not a residential camp
    if (currentCamp && currentCamp.type !== 'residential') {
      router.push(`/camps/${campId}/edit/basic-info`)
      return
    }

    if (currentCamp?.accommodation?.description) {
      setAccommodation(currentCamp.accommodation.description)
    }
  }, [currentCamp, campId, router])

  const handleChange = (value: string) => {
    setAccommodation(value)
    setHasUnsavedChanges(true)
  }

  // Don't render if not residential
  if (currentCamp && currentCamp.type !== 'residential') {
    return null
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Accommodation</h1>
        <p className="text-sm text-gray-600">
          Describe the accommodation facilities for residential campers
        </p>
      </div>

      <Card>
        <CardBody>
          <Textarea
            label="Accommodation"
            placeholder="Describe sleeping arrangements, room types, amenities, supervision, etc."
            value={accommodation}
            onValueChange={handleChange}
            minRows={8}
            description="Include details about cabins/dorms, bedding, bathrooms, and supervision"
          />
        </CardBody>
      </Card>
    </div>
  )
}
