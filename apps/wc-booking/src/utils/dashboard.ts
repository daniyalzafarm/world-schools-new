import type { GreetingTimeOfDay } from '@/types/dashboard'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function getTimeOfDayGreeting(now: Date = new Date()): GreetingTimeOfDay {
  const hour = now.getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

export function getGreetingLabel(tod: GreetingTimeOfDay): string {
  return tod === 'morning'
    ? 'Good morning'
    : tod === 'afternoon'
      ? 'Good afternoon'
      : 'Good evening'
}

function startOfDay(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

export function daysUntil(
  target: string | Date | null | undefined,
  now: Date = new Date()
): number | null {
  if (!target) return null
  const t = startOfDay(new Date(target))
  if (Number.isNaN(t)) return null
  return Math.round((t - startOfDay(now)) / MS_PER_DAY)
}

export function daysSince(
  target: string | Date | null | undefined,
  now: Date = new Date()
): number | null {
  const d = daysUntil(target, now)
  return d == null ? null : -d
}
