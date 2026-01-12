'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardBody, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'

export default function ArtsEditorPage() {
  const params = useParams()
  const _campId = params.id as string

  const { currentCamp, updateSection: _updateSection, setHasUnsavedChanges } = useCampsStore()
  const [arts, setArts] = useState('')

  useEffect(() => {
    if (currentCamp?.artsAndCrafts?.description) {
      setArts(currentCamp.artsAndCrafts.description)
    }
  }, [currentCamp])

  const handleChange = (value: string) => {
    setArts(value)
    setHasUnsavedChanges(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Arts & Crafts</h1>
        <p className="text-sm text-gray-600">
          Describe the arts and crafts activities at your camp
        </p>
      </div>

      <Card>
        <CardBody>
          <Textarea
            label="Arts & Crafts"
            placeholder="Describe arts and crafts activities (painting, sculpture, music, theater, etc.)"
            value={arts}
            onValueChange={handleChange}
            minRows={8}
            description="Include details about materials, projects, and creative opportunities"
          />
        </CardBody>
      </Card>
    </div>
  )
}
