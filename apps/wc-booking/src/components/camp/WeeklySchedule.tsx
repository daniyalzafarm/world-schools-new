'use client'

import { Tab, Tabs } from '@heroui/react'
import { DailySchedule } from './DailySchedule'
import type { WeeklyScheduleData } from '@/types/camps'

interface WeeklyScheduleProps {
  schedule: WeeklyScheduleData
  className?: string
}

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const

export function WeeklySchedule({ schedule, className = '' }: WeeklyScheduleProps) {
  // Check if schedule has any time slots
  const hasSchedule = DAYS.some(day => schedule[day.key]?.timeSlots?.length > 0)

  if (!hasSchedule) {
    return <div className="text-base text-gray-500">No weekly schedule available yet.</div>
  }

  // Get disabled keys (days without schedules)
  const disabledKeys = DAYS.filter(day => !schedule[day.key]?.timeSlots?.length).map(day => day.key)

  // Find first day with schedule as default
  const defaultSelectedKey =
    DAYS.find(day => schedule[day.key]?.timeSlots?.length > 0)?.key || 'monday'

  return (
    <div className={className}>
      <Tabs
        aria-label="Weekly Schedule"
        variant="solid"
        color="default"
        size="md"
        radius="lg"
        disabledKeys={disabledKeys}
        defaultSelectedKey={defaultSelectedKey}
        classNames={{
          tabList: 'gap-2 w-full flex-wrap',
          tab: 'px-4 py-2',
          cursor: 'bg-gray-900',
          tabContent: 'group-data-[selected=true]:text-white',
        }}
      >
        {DAYS.map(day => {
          const daySchedule = schedule[day.key]?.timeSlots || []

          return (
            <Tab key={day.key} title={day.label}>
              {daySchedule.length > 0 ? (
                <div className="mt-6">
                  <DailySchedule schedule={daySchedule} />
                </div>
              ) : (
                <div className="text-base text-gray-500 mt-6">
                  No activities scheduled for {day.label}.
                </div>
              )}
            </Tab>
          )
        })}
      </Tabs>
    </div>
  )
}
