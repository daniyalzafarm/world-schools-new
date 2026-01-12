'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardBody, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'

export default function AcademicsEditorPage() {
  const params = useParams()
  const _campId = params.id as string

  const { currentCamp, updateSection: _updateSection, setHasUnsavedChanges } = useCampsStore()
  const [academics, setAcademics] = useState('')

  useEffect(() => {
    if (currentCamp?.academics?.description) {
      setAcademics(currentCamp.academics.description)
    }
  }, [currentCamp])

  const handleChange = (value: string) => {
    setAcademics(value)
    setHasUnsavedChanges(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Academic Programs</h1>
        <p className="text-sm text-gray-600">Describe the academic programs at your camp</p>
      </div>

      <Card>
        <CardBody>
          <Textarea
            label="Academic Programs"
            placeholder="Describe academic activities (STEM, coding, robotics, science, etc.)"
            value={academics}
            onValueChange={handleChange}
            minRows={8}
            description="Include details about subjects, teaching methods, and learning outcomes"
          />
        </CardBody>
      </Card>
    </div>
  )
}
