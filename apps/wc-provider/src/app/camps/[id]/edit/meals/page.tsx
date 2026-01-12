'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardBody, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'

export default function MealsEditorPage() {
  const params = useParams()
  const campId = params.id as string

  const {
    currentCamp,
    updateSection: _updateSection,
    setHasUnsavedChanges,
    isLoading: _isLoading,
  } = useCampsStore()

  const [meals, setMeals] = useState('')

  useEffect(() => {
    if (currentCamp?.meals) {
      setMeals(JSON.stringify(currentCamp.meals, null, 2))
    }
  }, [currentCamp])

  const handleChange = (value: string) => {
    setMeals(value)
    setHasUnsavedChanges(true)
  }

  const _handleSave = async () => {
    if (!campId) return

    try {
      await _updateSection(campId, 'meals', { meals })
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Failed to save meals:', error)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Meals</h1>
        <p className="text-sm text-gray-600">Describe the meals provided at your camp</p>
      </div>

      <Card>
        <CardBody>
          <Textarea
            label="Meals Information"
            placeholder="Describe the meals provided (breakfast, lunch, dinner, snacks), dietary accommodations, etc."
            value={meals}
            onValueChange={handleChange}
            minRows={8}
            description="Include information about meal types, dietary options, and any special accommodations"
          />
        </CardBody>
      </Card>
    </div>
  )
}
