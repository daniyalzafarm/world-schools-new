'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardBody, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'

export default function GettingThereEditorPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.id as string

  const { currentCamp, updateSection: _updateSection, setHasUnsavedChanges } = useCampsStore()
  const [gettingThere, setGettingThere] = useState('')

  useEffect(() => {
    // Redirect if not a residential camp
    if (currentCamp && currentCamp.type !== 'residential') {
      router.push(`/camps/${campId}/edit/basic-info`)
      return
    }

    if (currentCamp?.gettingThere?.description) {
      setGettingThere(currentCamp.gettingThere.description)
    }
  }, [currentCamp, campId, router])

  const handleChange = (value: string) => {
    setGettingThere(value)
    setHasUnsavedChanges(true)
  }

  // Don't render if not residential
  if (currentCamp && currentCamp.type !== 'residential') {
    return null
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Getting There</h1>
        <p className="text-sm text-gray-600">Provide transportation and arrival information</p>
      </div>

      <Card>
        <CardBody>
          <Textarea
            label="Getting There"
            placeholder="Describe transportation options, pickup/drop-off details, directions, etc."
            value={gettingThere}
            onValueChange={handleChange}
            minRows={8}
            description="Include details about transportation services, meeting points, and travel arrangements"
          />
        </CardBody>
      </Card>
    </div>
  )
}
