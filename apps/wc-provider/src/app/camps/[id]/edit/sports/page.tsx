'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardBody, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'

export default function SportsEditorPage() {
  const params = useParams()
  const _campId = params.id as string

  const { currentCamp, updateSection: _updateSection, setHasUnsavedChanges } = useCampsStore()
  const [sports, setSports] = useState('')

  useEffect(() => {
    if (currentCamp?.sportsActivities?.description) {
      setSports(currentCamp.sportsActivities.description)
    }
  }, [currentCamp])

  const handleChange = (value: string) => {
    setSports(value)
    setHasUnsavedChanges(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Sports Activities</h1>
        <p className="text-sm text-gray-600">Describe the sports activities offered at your camp</p>
      </div>

      <Card>
        <CardBody>
          <Textarea
            label="Sports Activities"
            placeholder="Describe the sports activities (soccer, basketball, swimming, etc.)"
            value={sports}
            onValueChange={handleChange}
            minRows={8}
            description="Include details about equipment, skill levels, and coaching"
          />
        </CardBody>
      </Card>
    </div>
  )
}
