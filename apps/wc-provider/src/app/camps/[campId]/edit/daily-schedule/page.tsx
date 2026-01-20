'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Radio, RadioGroup, Tab, Tabs } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'
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
  const router = useRouter()
  const params = useParams()
  const campId = params.campId as string

  const {
    currentCamp,
    updateSection,
    fetchCamp,
    setHasUnsavedChanges,
    setWizardFormValid,
    setWizardFormSubmit,
  } = useCampsStore()

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

  const [originalData, setOriginalData] = useState<{
    scheduleType: 'daily' | 'weekly'
    dailyTimeSlots: TimeSlot[]
    weeklyTimeSlots: Record<string, TimeSlot[]>
  } | null>(null)

  // Fetch camp data on mount
  useEffect(() => {
    if (campId) {
      fetchCamp(campId).catch(error => {
        console.error('Failed to fetch camp:', error)
        router.push('/camps')
      })
    }

    // Cleanup on unmount
    return () => {
      setHasUnsavedChanges(false)
      setWizardFormValid(false)
      setWizardFormSubmit(null)
    }
  }, [campId, fetchCamp, router, setHasUnsavedChanges, setWizardFormValid, setWizardFormSubmit])

  // Load existing data from currentCamp
  useEffect(() => {
    if (currentCamp) {
      const type = (currentCamp.scheduleType as 'daily' | 'weekly') || 'daily'
      const dailySlots =
        currentCamp.dailySchedule && typeof currentCamp.dailySchedule === 'object'
          ? (currentCamp.dailySchedule as any).timeSlots || []
          : []
      const weeklySlots = currentCamp.weeklySchedule
        ? {
            monday: (currentCamp.weeklySchedule as any).monday?.timeSlots || [],
            tuesday: (currentCamp.weeklySchedule as any).tuesday?.timeSlots || [],
            wednesday: (currentCamp.weeklySchedule as any).wednesday?.timeSlots || [],
            thursday: (currentCamp.weeklySchedule as any).thursday?.timeSlots || [],
            friday: (currentCamp.weeklySchedule as any).friday?.timeSlots || [],
            saturday: (currentCamp.weeklySchedule as any).saturday?.timeSlots || [],
            sunday: (currentCamp.weeklySchedule as any).sunday?.timeSlots || [],
          }
        : {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: [],
            saturday: [],
            sunday: [],
          }

      setScheduleType(type)
      setDailyTimeSlots(dailySlots)
      setWeeklyTimeSlots(weeklySlots)
      setOriginalData({
        scheduleType: type,
        dailyTimeSlots: dailySlots,
        weeklyTimeSlots: weeklySlots,
      })
    }
  }, [currentCamp])

  // Detect form changes
  useEffect(() => {
    if (!originalData) return

    const hasChanges =
      scheduleType !== originalData.scheduleType ||
      JSON.stringify(dailyTimeSlots) !== JSON.stringify(originalData.dailyTimeSlots) ||
      JSON.stringify(weeklyTimeSlots) !== JSON.stringify(originalData.weeklyTimeSlots)

    setHasUnsavedChanges(hasChanges)
  }, [scheduleType, dailyTimeSlots, weeklyTimeSlots, originalData, setHasUnsavedChanges])

  // Update form validity (always valid for schedule)
  useEffect(() => {
    setWizardFormValid(true)
  }, [setWizardFormValid])

  // Register submit handler
  useEffect(() => {
    const handleFormSubmit = async () => {
      if (!campId) return

      try {
        const payload: any = {
          scheduleType: scheduleType,
          dailySchedule: scheduleType === 'daily' ? { timeSlots: dailyTimeSlots } : null,
          weeklySchedule:
            scheduleType === 'weekly'
              ? {
                  monday: { timeSlots: weeklyTimeSlots.monday },
                  tuesday: { timeSlots: weeklyTimeSlots.tuesday },
                  wednesday: { timeSlots: weeklyTimeSlots.wednesday },
                  thursday: { timeSlots: weeklyTimeSlots.thursday },
                  friday: { timeSlots: weeklyTimeSlots.friday },
                  saturday: { timeSlots: weeklyTimeSlots.saturday },
                  sunday: { timeSlots: weeklyTimeSlots.sunday },
                }
              : null,
        }

        await updateSection(campId, 'daily-schedule', payload)
        await fetchCamp(campId)
      } catch (error) {
        console.error('Failed to save schedule:', error)
        throw error
      }
    }

    setWizardFormSubmit(handleFormSubmit)

    return () => {
      setWizardFormSubmit(null)
    }
  }, [
    campId,
    scheduleType,
    dailyTimeSlots,
    weeklyTimeSlots,
    updateSection,
    fetchCamp,
    setWizardFormSubmit,
  ])

  const handleScheduleTypeChange = (type: 'daily' | 'weekly') => {
    setScheduleType(type)
  }

  const handleDailyTimeSlotsChange = (timeSlots: TimeSlot[]) => {
    setDailyTimeSlots(timeSlots)
  }

  const handleWeeklyTimeSlotsChange = (day: string, timeSlots: TimeSlot[]) => {
    setWeeklyTimeSlots({ ...weeklyTimeSlots, [day]: timeSlots })
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Daily Schedule</h1>
        <p className="text-base leading-normal text-default-500">
          Create a detailed timeline for your camp
        </p>
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
