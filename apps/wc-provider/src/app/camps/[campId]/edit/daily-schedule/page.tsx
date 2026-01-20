'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Radio, RadioGroup, Tab, Tabs } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'
import { AutoSaveIndicator } from '../../../../../components/camp-editor/AutoSaveIndicator'
import { TimelineBuilder } from '../../../../../components/camp-editor/TimelineBuilder'
import type { TimeSlot } from '../../../../../types/daily-schedule'

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

export default function DailyScheduleEditorPage() {
  const params = useParams()
  const campId = params.campId as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [scheduleType, setScheduleType] = useState<'daily' | 'weekly'>('daily')
  const [dailyTimeSlots, setDailyTimeSlots] = useState<TimeSlot[]>([])
  const [weeklyTimeSlots, setWeeklyTimeSlots] = useState<Record<string, TimeSlot[]>>({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  })
  const [selectedDay, setSelectedDay] = useState<string>('monday')

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  // Load existing data
  useEffect(() => {
    if (currentCamp?.scheduleType) {
      setScheduleType(currentCamp.scheduleType as 'daily' | 'weekly')
    }

    if (currentCamp?.dailySchedule) {
      const existing = currentCamp.dailySchedule as any
      setDailyTimeSlots(existing.timeSlots || [])
    }

    if (currentCamp?.weeklySchedule) {
      const existing = currentCamp.weeklySchedule as any
      setWeeklyTimeSlots({
        monday: existing.monday?.timeSlots || [],
        tuesday: existing.tuesday?.timeSlots || [],
        wednesday: existing.wednesday?.timeSlots || [],
        thursday: existing.thursday?.timeSlots || [],
        friday: existing.friday?.timeSlots || [],
        saturday: existing.saturday?.timeSlots || [],
        sunday: existing.sunday?.timeSlots || [],
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
  const triggerAutoSave = (
    type: 'daily' | 'weekly',
    dailySlots: TimeSlot[],
    weeklySlots: Record<string, TimeSlot[]>
  ) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')
    useCampsStore.setState({ hasPendingAutoSave: true, autoSaveStatus: 'saving' })

    const timeout = setTimeout(async () => {
      try {
        const payload: any = {
          scheduleType: type,
          dailySchedule: type === 'daily' ? { timeSlots: dailySlots } : null,
          weeklySchedule:
            type === 'weekly'
              ? {
                  monday: { timeSlots: weeklySlots.monday },
                  tuesday: { timeSlots: weeklySlots.tuesday },
                  wednesday: { timeSlots: weeklySlots.wednesday },
                  thursday: { timeSlots: weeklySlots.thursday },
                  friday: { timeSlots: weeklySlots.friday },
                  saturday: { timeSlots: weeklySlots.saturday },
                  sunday: { timeSlots: weeklySlots.sunday },
                }
              : null,
        }

        await updateSection(campId, 'daily-schedule', payload)
        setAutoSaveStatus('saved')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'saved' })
        setHasUnsavedChanges(false)
        setTimeout(() => {
          setAutoSaveStatus('idle')
          useCampsStore.setState({ autoSaveStatus: 'idle' })
        }, 2000)
      } catch (error) {
        console.error('Failed to save schedule:', error)
        setAutoSaveStatus('error')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'error' })
      }
    }, 1500)

    setSaveTimeout(timeout)
  }

  const handleScheduleTypeChange = (type: 'daily' | 'weekly') => {
    setScheduleType(type)
    triggerAutoSave(type, dailyTimeSlots, weeklyTimeSlots)
  }

  const handleDailyTimeSlotsChange = (timeSlots: TimeSlot[]) => {
    setDailyTimeSlots(timeSlots)
    triggerAutoSave(scheduleType, timeSlots, weeklyTimeSlots)
  }

  const handleWeeklyTimeSlotsChange = (day: string, timeSlots: TimeSlot[]) => {
    const updated = { ...weeklyTimeSlots, [day]: timeSlots }
    setWeeklyTimeSlots(updated)
    triggerAutoSave(scheduleType, dailyTimeSlots, updated)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Daily Schedule</h1>
          <p className="text-base leading-normal text-default-500">
            Create a detailed timeline for your camp
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-8">
        {/* Schedule Type Selector */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Schedule Type</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            Choose whether your camp follows the same schedule every day or varies by day of the
            week
          </p>
          <RadioGroup
            value={scheduleType}
            onValueChange={value => handleScheduleTypeChange(value as 'daily' | 'weekly')}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            <Radio
              value="daily"
              classNames={{
                base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                wrapper: 'group-data-[selected=true]:border-primary',
                labelWrapper: 'ml-2',
                label: 'text-sm',
              }}
            >
              <div className="flex flex-col gap-0.5">
                <div className="text-sm font-medium text-foreground">Daily Schedule</div>
                <div className="text-xs text-default-500">Same schedule every day</div>
              </div>
            </Radio>
            <Radio
              value="weekly"
              classNames={{
                base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                wrapper: 'group-data-[selected=true]:border-primary',
                labelWrapper: 'ml-2',
                label: 'text-sm',
              }}
            >
              <div className="flex flex-col gap-0.5">
                <div className="text-sm font-medium text-foreground">Weekly Schedule</div>
                <div className="text-xs text-default-500">Different schedule for each day</div>
              </div>
            </Radio>
          </RadioGroup>
        </div>

        {/* Daily Schedule */}
        {scheduleType === 'daily' && (
          <div className="form-group">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground">Daily Timeline</h3>
              <p className="text-sm text-default-500">
                This schedule will apply to all days of the week
              </p>
            </div>
            <TimelineBuilder timeSlots={dailyTimeSlots} onChange={handleDailyTimeSlotsChange} />
          </div>
        )}

        {/* Weekly Schedule */}
        {scheduleType === 'weekly' && (
          <div className="form-group">
            <Tabs
              selectedKey={selectedDay}
              onSelectionChange={key => setSelectedDay(key as string)}
              aria-label="Days of the week"
              classNames={{
                tabList: 'w-full',
                cursor: 'w-full',
                tab: 'max-w-fit',
              }}
              color="secondary"
            >
              {DAYS_OF_WEEK.map(day => (
                <Tab key={day} title={DAY_LABELS[day]}>
                  <div className="mt-6">
                    <TimelineBuilder
                      timeSlots={weeklyTimeSlots[day]}
                      onChange={timeSlots => handleWeeklyTimeSlotsChange(day, timeSlots)}
                    />
                  </div>
                </Tab>
              ))}
            </Tabs>
          </div>
        )}

        {/* Help Text */}
        <div className="rounded-lg bg-default-50 p-4">
          <div className="text-sm text-default-600">
            <p className="mb-2 font-semibold">Tips for creating a great schedule:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Include all major activities and meal times</li>
              <li>Add descriptions to give parents more context</li>
              <li>Use drag handles (⋮⋮) to reorder time slots</li>
              {scheduleType === 'weekly' && (
                <li>You can copy time slots from one day and paste them to another day</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
