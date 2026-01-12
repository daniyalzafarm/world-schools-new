'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardBody, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'

export default function WaterEditorPage() {
  const params = useParams()
  const _campId = params.id as string

  const { currentCamp, updateSection: _updateSection, setHasUnsavedChanges } = useCampsStore()
  const [water, setWater] = useState('')

  useEffect(() => {
    if (currentCamp?.waterActivities?.description) {
      setWater(currentCamp.waterActivities.description)
    }
  }, [currentCamp])

  const handleChange = (value: string) => {
    setWater(value)
    setHasUnsavedChanges(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Water Activities</h1>
        <p className="text-sm text-gray-600">Describe the water-based activities at your camp</p>
      </div>

      <Card>
        <CardBody>
          <Textarea
            label="Water Activities"
            placeholder="Describe water activities (swimming, kayaking, sailing, etc.)"
            value={water}
            onValueChange={handleChange}
            minRows={8}
            description="Include details about facilities, safety measures, and swimming requirements"
          />
        </CardBody>
      </Card>
    </div>
  )
}
