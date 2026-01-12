'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardBody, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'

export default function DailyScheduleEditorPage() {
  const params = useParams()
  const campId = params.id as string

  const {
    currentCamp,
    updateSection: _updateSection,
    setHasUnsavedChanges,
    isLoading: _isLoading,
  } = useCampsStore()

  const [dailySchedule, setDailySchedule] = useState('')

  useEffect(() => {
    if (currentCamp?.dailySchedule) {
      setDailySchedule(JSON.stringify(currentCamp.dailySchedule, null, 2))
    }
  }, [currentCamp])

  const handleChange = (value: string) => {
    setDailySchedule(value)
    setHasUnsavedChanges(true)
  }

  const _handleSave = async () => {
    if (!campId) return

    try {
      await _updateSection(campId, 'daily-schedule', { dailySchedule })
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Failed to save daily schedule:', error)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Daily Schedule</h1>
        <p className="text-sm text-gray-600">Describe a typical day at your camp</p>
      </div>

      <Card>
        <CardBody>
          <Textarea
            label="Daily Schedule"
            placeholder="Describe the typical daily schedule (e.g., 8:00 AM - Breakfast, 9:00 AM - Morning activities...)"
            value={dailySchedule}
            onValueChange={handleChange}
            minRows={10}
            description="Provide a detailed breakdown of a typical day"
          />
        </CardBody>
      </Card>
    </div>
  )
}
