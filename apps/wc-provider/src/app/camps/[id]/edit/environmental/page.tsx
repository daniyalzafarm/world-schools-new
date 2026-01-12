'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardBody, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'

export default function EnvironmentalEditorPage() {
  const params = useParams()
  const _campId = params.id as string

  const { currentCamp, updateSection: _updateSection, setHasUnsavedChanges } = useCampsStore()
  const [environmental, setEnvironmental] = useState('')

  useEffect(() => {
    if (currentCamp?.environmentalActivities?.description) {
      setEnvironmental(currentCamp.environmentalActivities.description)
    }
  }, [currentCamp])

  const handleChange = (value: string) => {
    setEnvironmental(value)
    setHasUnsavedChanges(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Environmental Activities</h1>
        <p className="text-sm text-gray-600">
          Describe the environmental and nature activities at your camp
        </p>
      </div>

      <Card>
        <CardBody>
          <Textarea
            label="Environmental Activities"
            placeholder="Describe environmental activities (nature walks, conservation projects, gardening, etc.)"
            value={environmental}
            onValueChange={handleChange}
            minRows={8}
            description="Include details about sustainability initiatives and outdoor education"
          />
        </CardBody>
      </Card>
    </div>
  )
}
