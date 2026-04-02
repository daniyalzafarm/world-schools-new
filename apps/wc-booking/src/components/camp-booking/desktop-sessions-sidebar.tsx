'use client'

import { useMemo } from 'react'
import type { Session } from '@/types/sessions'
import { formatCurrency } from '@/utils/currency'
import { useCampBookingStore } from '@/stores/camp-booking-store'
import { Check } from 'lucide-react'

function getSessionUnitPrice(session: Session | null | undefined): number {
  if (!session) return 0
  if (session.pricingType === 'single') return Number(session.price ?? 0)
  if (session.pricingType === 'age_group') {
    const prices = session.ageGroupPrices ?? []
    if (prices.length === 0) return 0
    return Math.min(...prices.map(p => Number(p.price ?? 0)))
  }
  return 0
}

function formatMonthShort(date: Date) {
  return date.toLocaleString('en-US', { month: 'short' })
}

function formatBeforeLabel(date: Date) {
  return date.toLocaleString('en-US', { month: 'long', day: 'numeric' })
}

export function DesktopSessionsSidebar() {
  const camp = useCampBookingStore(state => state.camp)
  const sessions = useCampBookingStore(state => state.sessions)
  const selectedSessionId = useCampBookingStore(state => state.selectedSessionId)

  const currency = useCampBookingStore(state => state.camp?.provider?.settings?.currency ?? 'EUR')

  const selectedSession = useMemo(
    () => sessions.find(s => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  )

  const sessionUnitPrice = getSessionUnitPrice(selectedSession)

  const sessionRangeText = useMemo(() => {
    if (!selectedSession) return ''
    const start = new Date(selectedSession.startDate)
    const end = new Date(selectedSession.endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''

    return `${start.getDate()}-${end.getDate()} ${formatMonthShort(start)} ${start.getFullYear()}`
  }, [selectedSession])

  const beforeCancellationText = useMemo(() => {
    if (!selectedSession) return ''
    const start = new Date(selectedSession.startDate)
    if (Number.isNaN(start.getTime())) return ''
    return formatBeforeLabel(start)
  }, [selectedSession])

  const campPhotoUrl = useMemo(() => {
    const photos = camp?.photos ?? []
    const primary = photos.find(p => p.isPrimary)
    const chosen = primary ?? photos[0]
    return chosen?.url ?? chosen?.thumbnail ?? null
  }, [camp])

  // Hard-coded for now (provider rating can be wired later).
  const ratingValue = 4.92
  const reviewsCount = 241

  const campSessionText = selectedSession
    ? sessionRangeText || selectedSession.name
    : 'Select a session'

  return (
    <aside className="hidden lg:block sticky top-[120px] md:top-[128px]">
      <div className="space-y-3">
        {/* Camp info card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gray-100">
              {campPhotoUrl ? (
                <img
                  src={campPhotoUrl}
                  alt={camp?.name ?? 'Camp'}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 truncate">{camp?.name ?? ''}</p>
              <p className="mt-1 text-sm text-gray-600">
                <span className="text-primary-600">★</span> {ratingValue.toFixed(1)} ({reviewsCount}
                )
              </p>
              <p className="mt-2 text-sm text-gray-500">{campSessionText}</p>
            </div>
          </div>
        </div>

        {/* Price details card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900">Price details</h3>
          {!selectedSession ? (
            <p className="mt-4 text-sm text-gray-500">Select a session to see pricing</p>
          ) : (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between font-medium text-gray-700">
                <span>
                  1 camper x
                  <span className="ml-1 text-sm">{formatCurrency(sessionUnitPrice, currency)}</span>
                </span>
                <span>{formatCurrency(sessionUnitPrice, currency)}</span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(sessionUnitPrice, currency)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Trust / cancellation card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Check size={20} className="text-primary-600" />
              <p className="text-sm font-medium text-gray-900">Free cancellation</p>
              {beforeCancellationText ? (
                <p className="text-sm text-gray-600">· before {beforeCancellationText}</p>
              ) : null}
            </div>

            <div className="flex items-start gap-3">
              <Check size={20} className="text-primary-600" />
              <p className="text-sm text-gray-700">No payment until camp confirms</p>
            </div>

            <div className="flex items-start gap-3">
              <Check size={20} className="text-primary-600" />
              <p className="text-sm text-gray-700">Secure checkout · data encrypted</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
