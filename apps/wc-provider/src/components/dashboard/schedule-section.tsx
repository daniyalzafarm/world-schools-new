'use client'

import { cn } from '@world-schools/ui-web'
import type { Camp } from '@/types/camps'
import type { Session } from '@/types/sessions'
import type { TimeSlot } from '@/types/daily-schedule'
import { daysSince } from '@/utils/provider-dashboard'
import { Section } from './section'

interface ScheduleSectionProps {
  camp: Camp
  liveSession: Session
  now?: Date
}

type ScheduleStatus = 'completed' | 'in-progress' | 'upcoming'

const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

function pickTodaysSlots(camp: Camp, now: Date): TimeSlot[] {
  const type = camp.scheduleType
  if (type === 'daily') {
    const ds = camp.dailySchedule as { timeSlots?: TimeSlot[] } | null | undefined
    return Array.isArray(ds?.timeSlots) ? ds.timeSlots : []
  }
  if (type === 'weekly') {
    const ws = camp.weeklySchedule as
      | Record<(typeof WEEKDAY_KEYS)[number], { timeSlots?: TimeSlot[] } | undefined>
      | null
      | undefined
    const key = WEEKDAY_KEYS[now.getDay()]
    return Array.isArray(ws?.[key]?.timeSlots) ? (ws![key]!.timeSlots as TimeSlot[]) : []
  }
  return []
}

function parseMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

function formatTime(time: string): string {
  const minutes = parseMinutes(time)
  if (minutes == null) return time
  const d = new Date()
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
}

function deriveStatuses(slots: TimeSlot[], now: Date): ScheduleStatus[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const sorted = slots
    .map((s, i) => ({
      slot: s,
      index: i,
      minutes: parseMinutes(s.time) ?? Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.minutes - b.minutes)

  let activeIndex = -1
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].minutes <= nowMinutes) {
      activeIndex = i
      break
    }
  }

  const statusBySorted = sorted.map((_, i): ScheduleStatus => {
    if (activeIndex < 0) return 'upcoming'
    if (i < activeIndex) return 'completed'
    if (i === activeIndex) return 'in-progress'
    return 'upcoming'
  })

  // map back to original input order
  const statusByOriginal: ScheduleStatus[] = new Array(slots.length).fill('upcoming')
  sorted.forEach((entry, sortedIdx) => {
    statusByOriginal[entry.index] = statusBySorted[sortedIdx]
  })

  return statusByOriginal
}

const STATUS_CLASS: Record<ScheduleStatus, string> = {
  completed: 'bg-success-50 text-success-700',
  'in-progress': 'bg-primary-50 text-primary-700',
  upcoming: 'bg-default-100 text-default-700',
}

const STATUS_LABEL: Record<ScheduleStatus, string> = {
  completed: 'Completed',
  'in-progress': 'In progress',
  upcoming: 'Upcoming',
}

export function ScheduleSection({ camp, liveSession, now = new Date() }: ScheduleSectionProps) {
  const slots = pickTodaysSlots(camp, now)
  if (slots.length === 0) return null

  // Sort for display (ascending by time) but keep original-order statuses for clarity
  const sortedForDisplay = [...slots].sort((a, b) => {
    const am = parseMinutes(a.time) ?? Number.POSITIVE_INFINITY
    const bm = parseMinutes(b.time) ?? Number.POSITIVE_INFINITY
    return am - bm
  })
  const statuses = deriveStatuses(slots, now)
  const statusBySlotId = new Map(slots.map((s, i) => [s.id, statuses[i]]))

  const dayNumber = (daysSince(liveSession.startDate, now) ?? 0) + 1
  const title = dayNumber >= 1 ? `Today's schedule — Day ${dayNumber}` : "Today's schedule"

  return (
    <Section title={title}>
      <ul className="divide-y divide-default-200 rounded-2xl border border-default-200 bg-background">
        {sortedForDisplay.map(slot => {
          const status = statusBySlotId.get(slot.id) ?? 'upcoming'
          return (
            <li key={slot.id} className="flex items-center gap-4 px-4 py-3">
              <span className="min-w-[72px] text-sm font-semibold text-default-500">
                {formatTime(slot.time)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{slot.activity}</p>
                {slot.description && (
                  <p className="truncate text-xs text-default-500">{slot.description}</p>
                )}
              </div>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                  STATUS_CLASS[status]
                )}
              >
                {status === 'in-progress' && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-500 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-500" />
                  </span>
                )}
                {STATUS_LABEL[status]}
              </span>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
