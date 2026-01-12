'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardBody, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'

export default function AdventureEditorPage() {
  const params = useParams()
  const _campId = params.id as string

  const { currentCamp, updateSection: _updateSection, setHasUnsavedChanges } = useCampsStore()
  const [adventure, setAdventure] = useState('')

  useEffect(() => {
    if (currentCamp?.adventureActivities?.description) {
      setAdventure(currentCamp.adventureActivities.description)
    }
  }, [currentCamp])

  const handleChange = (value: string) => {
    setAdventure(value)
    setHasUnsavedChanges(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Adventure Activities</h1>
        <p className="text-sm text-gray-600">Describe the adventure activities at your camp</p>
      </div>

      <Card>
        <CardBody>
          <Textarea
            label="Adventure Activities"
            placeholder="Describe adventure activities (hiking, rock climbing, zip-lining, etc.)"
            value={adventure}
            onValueChange={handleChange}
            minRows={8}
            description="Include details about safety measures, equipment, and experience levels"
          />
        </CardBody>
      </Card>
    </div>
  )
}
