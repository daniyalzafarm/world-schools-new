'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardBody, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'

export default function LanguagesEditorPage() {
  const params = useParams()
  const _campId = params.id as string

  const { currentCamp, updateSection: _updateSection, setHasUnsavedChanges } = useCampsStore()
  const [languagesProgram, setLanguagesProgram] = useState('')

  useEffect(() => {
    if (currentCamp?.languagePrograms?.description) {
      setLanguagesProgram(currentCamp.languagePrograms.description)
    }
  }, [currentCamp])

  const handleChange = (value: string) => {
    setLanguagesProgram(value)
    setHasUnsavedChanges(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Language Programs</h1>
        <p className="text-sm text-gray-600">
          Describe the language learning programs at your camp
        </p>
      </div>

      <Card>
        <CardBody>
          <Textarea
            label="Language Programs"
            placeholder="Describe language learning activities and programs"
            value={languagesProgram}
            onValueChange={handleChange}
            minRows={8}
            description="Include details about languages taught, teaching methods, and skill levels"
          />
        </CardBody>
      </Card>
    </div>
  )
}
