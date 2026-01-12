'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardBody, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'

export default function WhatsIncludedEditorPage() {
  const params = useParams()
  const campId = params.id as string

  const {
    currentCamp,
    updateSection: _updateSection,
    setHasUnsavedChanges,
    isLoading: _isLoading,
  } = useCampsStore()

  const [whatsIncluded, setWhatsIncluded] = useState('')

  useEffect(() => {
    if (currentCamp?.whatsIncluded) {
      setWhatsIncluded(JSON.stringify(currentCamp.whatsIncluded, null, 2))
    }
  }, [currentCamp])

  const handleChange = (value: string) => {
    setWhatsIncluded(value)
    setHasUnsavedChanges(true)
  }

  const _handleSave = async () => {
    if (!campId) return

    try {
      await _updateSection(campId, 'whats-included', { whatsIncluded })
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Failed to save whats included:', error)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">What's Included</h1>
        <p className="text-sm text-gray-600">Describe what's included in the camp fee</p>
      </div>

      <Card>
        <CardBody>
          <Textarea
            label="What's Included"
            placeholder="List everything that's included in the camp fee (meals, activities, equipment, etc.)"
            value={whatsIncluded}
            onValueChange={handleChange}
            minRows={8}
            description="Describe all items and services included in the camp fee"
          />
        </CardBody>
      </Card>
    </div>
  )
}
