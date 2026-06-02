import type { BookingGroupStatus } from '@world-schools/wc-types'

export const UPCOMING_STATUSES: BookingGroupStatus[] = [
  'draft',
  'request',
  'accepted',
  'declined',
  'expired',
  'deposit_paid',
  'fully_paid',
  'at_camp',
]

export function statusLabel(status: BookingGroupStatus): string {
  const map: Record<BookingGroupStatus, string> = {
    draft: 'Draft',
    request: 'Pending review',
    accepted: 'Confirmed',
    declined: 'Declined',
    expired: 'Expired',
    deposit_paid: 'Deposit paid',
    fully_paid: 'Fully paid',
    at_camp: 'At camp',
    completed: 'Completed',
    cancelled: 'Cancelled',
    payment_failed: 'Payment failed',
    partially_refunded: 'Partially refunded',
    fully_refunded: 'Refunded',
    disputed: 'Disputed',
  }
  return map[status] ?? status
}

/** Provider dashboard copy where it differs from the parent-facing label. */
export function providerStatusLabel(status: BookingGroupStatus): string {
  const map: Record<BookingGroupStatus, string> = {
    draft: 'Draft',
    request: 'New request',
    accepted: 'Confirmed',
    declined: 'Declined',
    expired: 'Expired',
    deposit_paid: 'Deposit paid',
    fully_paid: 'Fully paid',
    at_camp: 'At camp',
    completed: 'Completed',
    cancelled: 'Cancelled',
    payment_failed: 'Payment failed',
    partially_refunded: 'Partially refunded',
    fully_refunded: 'Refunded',
    disputed: 'Disputed',
  }
  return map[status] ?? status
}

export function statusBadgeClass(status: BookingGroupStatus): string {
  switch (status) {
    case 'request':
    case 'expired':
      return 'bg-warning-100 text-warning-800 border border-warning-200'
    case 'accepted':
    case 'fully_paid':
    case 'at_camp':
      return 'bg-success-500 text-white'
    case 'draft':
      return 'bg-default-100 text-default-700'
    case 'deposit_paid':
      return 'bg-primary-100 text-primary-800'
    case 'declined':
    case 'cancelled':
      return 'bg-danger-100 text-danger-800'
    case 'completed':
      return 'bg-success-100 text-success-800'
    default:
      return 'bg-default-100 text-default-700'
  }
}

export function progressPercent(status: BookingGroupStatus): number {
  const map: Record<BookingGroupStatus, number> = {
    draft: 12,
    request: 28,
    accepted: 42,
    declined: 20,
    expired: 25,
    deposit_paid: 58,
    fully_paid: 72,
    at_camp: 88,
    completed: 100,
    cancelled: 0,
    payment_failed: 58,
    partially_refunded: 72,
    fully_refunded: 0,
    disputed: 72,
  }
  return map[status] ?? 20
}

export function progressBarColor(status: BookingGroupStatus): string {
  if (status === 'cancelled' || status === 'declined') return 'bg-danger-400'
  if (status === 'completed' || status === 'fully_paid' || status === 'at_camp')
    return 'bg-success-500'
  if (status === 'request' || status === 'expired') return 'bg-warning-500'
  return 'bg-primary-500'
}

export function ageFromDateOfBirth(iso: string | null): number | null {
  if (!iso) return null
  const birthDate = new Date(iso)
  if (Number.isNaN(birthDate.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

export function formatSessionRange(startIso: string, endIso: string, sessionName: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return sessionName
  const a = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const b = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${a} – ${b} · ${sessionName}`
}

function formatTimeLabel(hhmm: string | null): string | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function formatDropoffPickupLabels(
  startIso: string,
  endIso: string,
  arrivalTime: string | null,
  departureTime: string | null,
  sessionDayType: 'full_day' | 'half_day' | null
): {
  dropoffDate: string
  dropoffTime: string | null
  pickupDate: string
  pickupTime: string | null
} {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const dropoffDate = Number.isNaN(start.getTime())
    ? '—'
    : start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const pickupDate = Number.isNaN(end.getTime())
    ? '—'
    : end.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const showTimes = sessionDayType === 'half_day'
  return {
    dropoffDate,
    dropoffTime: showTimes ? formatTimeLabel(arrivalTime) : null,
    pickupDate,
    pickupTime: showTimes ? formatTimeLabel(departureTime) : null,
  }
}

export interface JourneyStep {
  key: string
  label: string
  description: string
}

export type JourneyStepState = 'done' | 'current' | 'upcoming'

export function journeyStepStates(status: BookingGroupStatus): {
  steps: JourneyStep[]
  states: JourneyStepState[]
} {
  if (status === 'declined' || status === 'cancelled' || status === 'expired') {
    const steps: JourneyStep[] = [
      { key: 'request', label: 'Request sent', description: 'Submitted to the camp' },
      {
        key: 'ended',
        label:
          status === 'declined' ? 'Declined' : status === 'cancelled' ? 'Cancelled' : 'Expired',
        description: 'This booking did not continue',
      },
    ]
    return { steps, states: ['done', 'current'] }
  }

  if (status === 'draft') {
    const steps: JourneyStep[] = [
      { key: 'draft', label: 'Draft', description: 'Finish your booking request' },
    ]
    return { steps, states: ['current'] }
  }

  const steps: JourneyStep[] = [
    { key: 'request', label: 'Request sent', description: 'Submitted to the camp' },
    { key: 'accepted', label: 'Camp confirmed', description: 'Accepted and next steps' },
    { key: 'forms', label: 'Forms & details', description: 'Complete required information' },
    { key: 'balance', label: 'Payment complete', description: 'Deposit and balance settled' },
    { key: 'ready', label: 'Camp week', description: 'During or after your session' },
  ]

  let current = 0
  if (status === 'request') current = 0
  else if (status === 'accepted') current = 1
  else if (status === 'deposit_paid') current = 2
  else if (status === 'fully_paid') current = 3
  else if (status === 'at_camp' || status === 'completed') current = 4

  const states: JourneyStepState[] = steps.map((_, i) => {
    if (i < current) return 'done'
    if (i === current) return 'current'
    return 'upcoming'
  })

  if (status === 'completed') {
    return {
      steps,
      states: ['done', 'done', 'done', 'done', 'done'],
    }
  }

  return { steps, states }
}

/**
 * Short urgency line for provider request rows when `expiresAt` is set (otherwise null).
 */
export function providerRequestUrgencyLabel(expiresAt: string | null): string | null {
  if (!expiresAt) return null
  const end = new Date(expiresAt)
  if (Number.isNaN(end.getTime())) return null
  const ms = end.getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const hours = Math.floor(ms / 3600000)
  if (hours < 48) {
    if (hours <= 0) return 'Expires soon'
    return hours < 24 ? `Expires in ${hours}h` : `Expires in ${Math.ceil(hours / 24)}d`
  }
  const days = Math.floor(hours / 24)
  return `Expires in ${days}d`
}

/** Visual variant for provider request detail status banner (reference panel v9). */
export type ProviderRequestBannerVariant = 'calm' | 'warning' | 'urgent'

export function providerRequestBannerVariant(
  expiresAt: string | null
): ProviderRequestBannerVariant {
  if (!expiresAt) return 'calm'
  const end = new Date(expiresAt)
  if (Number.isNaN(end.getTime())) return 'calm'
  const ms = end.getTime() - Date.now()
  if (ms <= 0) return 'urgent'
  const hours = ms / 3600000
  if (hours <= 6) return 'urgent'
  if (hours <= 24) return 'warning'
  return 'calm'
}
