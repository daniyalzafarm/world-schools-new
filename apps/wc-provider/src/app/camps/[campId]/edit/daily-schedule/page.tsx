'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, Input, Select, SelectItem } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'
import { AutoSaveIndicator } from '../../../../../components/camp-editor/AutoSaveIndicator'
import { TimelineBuilder } from '../../../../../components/camp-editor/TimelineBuilder'
import type { DailyScheduleData, Schedule } from '../../../../../types/daily-schedule'

const SCHEDULE_TYPES = [
  { value: 'daily', label: 'Daily Schedule (same every day)' },
  { value: 'weekly', label: 'Weekly Schedule (varies by day)' },
]

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function DailyScheduleEditorPage() {
  const params = useParams()
  const campId = params.campId as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [data, setData] = useState<DailyScheduleData>({
    schedules: [],
  })

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  // Load existing data
  useEffect(() => {
    if (currentCamp?.dailySchedule) {
      const existing = currentCamp.dailySchedule as any
      if (existing.schedules) {
        setData(existing)
      } else {
        // Initialize with a default daily schedule
        setData({
          schedules: [
            {
              id: `schedule-${Date.now()}`,
              type: 'daily',
              timeSlots: [],
            },
          ],
        })
      }
    } else {
      // Initialize with a default daily schedule
      setData({
        schedules: [
          {
            id: `schedule-${Date.now()}`,
            type: 'daily',
            timeSlots: [],
          },
        ],
      })
    }
  }, [currentCamp])

  // Cleanup on unmount - clear pending auto-save state
  useEffect(() => {
    return () => {
      useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'idle' })
    }
  }, [])

  // Auto-save handler
  const triggerAutoSave = (updatedData: DailyScheduleData) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')
    // Update store to indicate pending auto-save (debounce period)
    useCampsStore.setState({ hasPendingAutoSave: true, autoSaveStatus: 'saving' })

    const timeout = setTimeout(async () => {
      try {
        await updateSection(campId, 'daily-schedule', { dailySchedule: updatedData })
        setAutoSaveStatus('saved')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'saved' })
        setHasUnsavedChanges(false)
        setTimeout(() => {
          setAutoSaveStatus('idle')
          useCampsStore.setState({ autoSaveStatus: 'idle' })
        }, 2000)
      } catch (error) {
        console.error('Failed to save daily schedule:', error)
        setAutoSaveStatus('error')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'error' })
      }
    }, 1500)

    setSaveTimeout(timeout)
  }

  const addSchedule = (type: 'daily' | 'weekly') => {
    const newSchedule: Schedule = {
      id: `schedule-${Date.now()}`,
      type,
      timeSlots: [],
    }

    const updated = {
      schedules: [...data.schedules, newSchedule],
    }

    setData(updated)
    triggerAutoSave(updated)
  }

  const updateSchedule = (index: number, schedule: Schedule) => {
    const updated = {
      schedules: data.schedules.map((s, i) => (i === index ? schedule : s)),
    }
    setData(updated)
    triggerAutoSave(updated)
  }

  const deleteSchedule = (index: number) => {
    const updated = {
      schedules: data.schedules.filter((_, i) => i !== index),
    }
    setData(updated)
    triggerAutoSave(updated)
  }

  const updateScheduleType = (index: number, type: 'daily' | 'weekly') => {
    const schedule = data.schedules[index]
    const updated = {
      schedules: data.schedules.map((s, i) =>
        i === index
          ? {
              ...s,
              type,
              day: type === 'weekly' ? 'Monday' : undefined,
            }
          : s
      ),
    }
    setData(updated)
    triggerAutoSave(updated)
  }

  const updateScheduleDay = (index: number, day: string) => {
    const updated = {
      schedules: data.schedules.map((s, i) => (i === index ? { ...s, day } : s)),
    }
    setData(updated)
    triggerAutoSave(updated)
  }

  const updateScheduleAgeGroup = (index: number, ageGroup: string) => {
    const updated = {
      schedules: data.schedules.map((s, i) => (i === index ? { ...s, ageGroup } : s)),
    }
    setData(updated)
    triggerAutoSave(updated)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Daily Schedule</h1>
          <p className="text-base leading-normal text-default-500">
            Create a detailed timeline of a typical day at your camp
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-8">
        {/* Schedules */}
        {data.schedules.map((schedule, index) => (
          <div key={schedule.id} className="form-group">
            {/* Schedule Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-3">
                <div className="flex gap-3">
                  <Select
                    label="Schedule Type"
                    selectedKeys={[schedule.type]}
                    onSelectionChange={keys => {
                      const type = Array.from(keys)[0] as 'daily' | 'weekly'
                      updateScheduleType(index, type)
                    }}
                    className="max-w-xs"
                    size="sm"
                  >
                    {SCHEDULE_TYPES.map(type => (
                      <SelectItem key={type.value}>{type.label}</SelectItem>
                    ))}
                  </Select>

                  {schedule.type === 'weekly' && (
                    <Select
                      label="Day of Week"
                      selectedKeys={schedule.day ? [schedule.day] : []}
                      onSelectionChange={keys => {
                        const day = Array.from(keys)[0] as string
                        updateScheduleDay(index, day)
                      }}
                      className="max-w-xs"
                      size="sm"
                    >
                      {DAYS_OF_WEEK.map(day => (
                        <SelectItem key={day}>{day}</SelectItem>
                      ))}
                    </Select>
                  )}
                </div>

                <Input
                  label="Age Group (Optional)"
                  placeholder="e.g., Ages 8-12, Juniors, Seniors"
                  value={schedule.ageGroup || ''}
                  onValueChange={value => updateScheduleAgeGroup(index, value)}
                  className="max-w-xs"
                  size="sm"
                />
              </div>

              {data.schedules.length > 1 && (
                <button
                  type="button"
                  onClick={() => deleteSchedule(index)}
                  className="text-default-400 hover:text-danger"
                  title="Delete schedule"
                >
                  🗑️
                </button>
              )}
            </div>

            {/* Timeline Builder */}
            <TimelineBuilder
              schedule={schedule}
              onChange={updated => updateSchedule(index, updated)}
            />
          </div>
        ))}

        {/* Add Schedule Buttons */}
        <div className="flex gap-3">
          <Button
            onPress={() => addSchedule('daily')}
            variant="bordered"
            className="flex-1"
            isDisabled={data.schedules.some(s => s.type === 'daily')}
          >
            + Add Daily Schedule
          </Button>
          <Button onPress={() => addSchedule('weekly')} variant="bordered" className="flex-1">
            + Add Weekly Schedule
          </Button>
        </div>

        {/* Help Text */}
        <div className="rounded-lg bg-default-50 p-4">
          <div className="text-sm text-default-600">
            <p className="mb-2 font-semibold">Tips for creating a great schedule:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Include all major activities and meal times</li>
              <li>Add descriptions to give parents more context</li>
              <li>Use drag handles (⋮⋮) to reorder time slots</li>
              <li>Create separate schedules for different age groups if needed</li>
              <li>For weekly schedules, create one for each day that differs</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
