'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardBody, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'

export default function ReligionEditorPage() {
  const params = useParams()
  const _campId = params.id as string

  const { currentCamp, updateSection: _updateSection, setHasUnsavedChanges } = useCampsStore()
  const [religion, setReligion] = useState('')

  useEffect(() => {
    if (currentCamp?.religionPrograms?.description) {
      setReligion(currentCamp.religionPrograms.description)
    }
  }, [currentCamp])

  const handleChange = (value: string) => {
    setReligion(value)
    setHasUnsavedChanges(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Religious Programs</h1>
        <p className="text-sm text-gray-600">
          Describe any religious or spiritual programs at your camp
        </p>
      </div>

      <Card>
        <CardBody>
          <Textarea
            label="Religious Programs"
            placeholder="Describe religious activities, services, or spiritual programs (if applicable)"
            value={religion}
            onValueChange={handleChange}
            minRows={8}
            description="Include details about religious observances, interfaith activities, or spiritual development"
          />
        </CardBody>
      </Card>
    </div>
  )
}
