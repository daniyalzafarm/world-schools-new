'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Radio, RadioGroup, Tab, Tabs } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'
import { useAutosave } from '../../../../../hooks/useAutosave'
import {
  TimelineBuilder,
  type TimeSlotError,
} from '../../../../../components/camp-editor/TimelineBuilder'
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

const isSlotIncomplete = (slot: TimeSlot): boolean =>
  !slot.time || slot.time.trim() === '' || !slot.activity || slot.activity.trim() === ''

const buildSlotErrors = (timeSlots: TimeSlot[]): Record<string, TimeSlotError> => {
  const errors: Record<string, TimeSlotError> = {}
  timeSlots.forEach(slot => {
    const slotErrors: TimeSlotError = {}
    if (!slot.time || slot.time.trim() === '') slotErrors.time = 'Time is required'
    if (!slot.activity || slot.activity.trim() === '')
      slotErrors.activity = 'Activity name is required'
    if (Object.keys(slotErrors).length > 0) errors[slot.id] = slotErrors
  })
  return errors
}

export default function DailyScheduleEditorPage() {
  const router = useRouter()
  const params = useParams()
  const campId = params.campId as string

  const { currentCamp, updateSection, fetchCamp } = useCampsStore()

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
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (campId) {
      fetchCamp(campId).catch(error => {
        console.error('Failed to fetch camp:', error)
        router.push('/camps')
      })
    }
  }, [campId, fetchCamp, router])

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
      setIsLoaded(true)
    }
  }, [currentCamp])

  const dailyErrors = useMemo(() => buildSlotErrors(dailyTimeSlots), [dailyTimeSlots])
  const weeklyErrors = useMemo(
    () =>
      DAYS_OF_WEEK.reduce<Record<string, Record<string, TimeSlotError>>>((acc, day) => {
        acc[day] = buildSlotErrors(weeklyTimeSlots[day])
        return acc
      }, {}),
    [weeklyTimeSlots]
  )

  const hasIncompleteSlots =
    scheduleType === 'daily'
      ? dailyTimeSlots.some(isSlotIncomplete)
      : DAYS_OF_WEEK.some(day => weeklyTimeSlots[day].some(isSlotIncomplete))

  const payload = useMemo(
    () => ({
      scheduleType,
      dailySchedule: { timeSlots: dailyTimeSlots },
      weeklySchedule: {
        monday: { timeSlots: weeklyTimeSlots.monday },
        tuesday: { timeSlots: weeklyTimeSlots.tuesday },
        wednesday: { timeSlots: weeklyTimeSlots.wednesday },
        thursday: { timeSlots: weeklyTimeSlots.thursday },
        friday: { timeSlots: weeklyTimeSlots.friday },
        saturday: { timeSlots: weeklyTimeSlots.saturday },
        sunday: { timeSlots: weeklyTimeSlots.sunday },
      },
    }),
    [scheduleType, dailyTimeSlots, weeklyTimeSlots]
  )

  useAutosave(payload, {
    enabled: isLoaded && !hasIncompleteSlots,
    ready: isLoaded,
    save: async data => {
      await updateSection(campId, 'daily-schedule', data)
      if (!useCampsStore.getState().error) {
        await fetchCamp(campId)
      }
    },
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Daily Schedule</h1>
        <p className="text-base leading-normal text-default-500">
          Create a detailed timeline for your camp
        </p>
      </div>

      <div className="space-y-8">
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
            onValueChange={value => setScheduleType(value as 'daily' | 'weekly')}
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

        {scheduleType === 'daily' && (
          <div className="form-group">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground">Daily Timeline</h3>
              <p className="text-sm text-default-500">
                This schedule will apply to all days of the week
              </p>
            </div>
            <TimelineBuilder
              timeSlots={dailyTimeSlots}
              onChange={setDailyTimeSlots}
              errors={dailyErrors}
            />
          </div>
        )}

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
                      onChange={timeSlots =>
                        setWeeklyTimeSlots(prev => ({ ...prev, [day]: timeSlots }))
                      }
                      errors={weeklyErrors[day]}
                    />
                  </div>
                </Tab>
              ))}
            </Tabs>
          </div>
        )}

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
