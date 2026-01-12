'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardBody, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'

export default function CampFocusEditorPage() {
  const params = useParams()
  const _campId = params.id as string

  const { currentCamp, updateSection: _updateSection, setHasUnsavedChanges } = useCampsStore()
  const [campFocus, setCampFocus] = useState('')

  useEffect(() => {
    if (currentCamp?.campFocus?.description) {
      setCampFocus(currentCamp.campFocus.description)
    }
  }, [currentCamp])

  const handleChange = (value: string) => {
    setCampFocus(value)
    setHasUnsavedChanges(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Camp Focus</h1>
        <p className="text-sm text-gray-600">
          Describe the overall focus and philosophy of your camp
        </p>
      </div>

      <Card>
        <CardBody>
          <Textarea
            label="Camp Focus"
            placeholder="Describe the camp's mission, values, educational philosophy, and what makes it unique"
            value={campFocus}
            onValueChange={handleChange}
            minRows={8}
            description="Include details about your camp's approach, goals, and what campers will gain"
          />
        </CardBody>
      </Card>
    </div>
  )
}
