import type { Session } from '@/types/sessions'

export function formatMonthShort(date: Date): string {
  return date.toLocaleString('en-US', { month: 'short' })
}

// Cutoff comes from getFreeCancellationCutoffDate which anchors to UTC; format
// in UTC so the displayed calendar date is stable across viewer timezones
// (otherwise eastern viewers see a day-earlier shift).
export function formatCancellationCutoffLabel(date: Date): string {
  return date.toLocaleString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
}

export function formatSessionRangeShort(session: Session | null | undefined): string {
  if (!session) return ''
  const start = new Date(session.startDate)
  const end = new Date(session.endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''
  return `${start.getDate()}-${end.getDate()} ${formatMonthShort(start)} ${start.getFullYear()}`
}

export function getGoogleReviewsUrl(placeId: string | null | undefined): string | null {
  return placeId ? `https://search.google.com/local/reviews?placeid=${placeId}` : null
}
