'use client'

import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { useCampBookingStore } from '@/stores/camp-booking-store'
import { formatCurrency } from '@/utils/currency'
import {
  getSelectedChildrenPriceBreakdown,
  getSelectedChildrenSubtotal,
} from '@/components/camp-booking/booking-flow-pricing'

function formatMonthShort(date: Date) {
  return date.toLocaleString('en-US', { month: 'short' })
}

function formatBeforeLabel(date: Date) {
  return date.toLocaleString('en-US', { month: 'long', day: 'numeric' })
}

export function DesktopChildrenSidebar() {
  const camp = useCampBookingStore(state => state.camp)
  const sessions = useCampBookingStore(state => state.sessions)
  const selectedSessionId = useCampBookingStore(state => state.selectedSessionId)
  const children = useCampBookingStore(state => state.children)
  const selectedChildIds = useCampBookingStore(state => state.selectedChildIds)
  const setStep = useCampBookingStore(state => state.setStep)

  const currency = useCampBookingStore(state => state.camp?.provider?.settings?.currency ?? 'EUR')

  const selectedSession = useMemo(
    () => sessions.find(s => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  )

  const campPhotoUrl = useMemo(() => {
    const photos = camp?.photos ?? []
    const primary = photos.find(p => p.isPrimary)
    const chosen = primary ?? photos[0]
    return chosen?.url ?? chosen?.thumbnail ?? null
  }, [camp])

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

  const campSessionText = selectedSession
    ? sessionRangeText || selectedSession.name
    : 'Select a session'

  const breakdown = useMemo(
    () =>
      getSelectedChildrenPriceBreakdown({
        session: selectedSession,
        camp,
        children,
        selectedChildIds,
      }),
    [selectedSession, camp, children, selectedChildIds]
  )

  const subtotal = useMemo(
    () =>
      getSelectedChildrenSubtotal({
        session: selectedSession,
        camp,
        children,
        selectedChildIds,
      }),
    [selectedSession, camp, children, selectedChildIds]
  )

  // Hard-coded for now (provider rating can be wired later).
  const ratingValue = 4.92
  const reviewsCount = 241

  return (
    <aside className="hidden lg:block sticky top-28 md:top-32">
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
              <button
                type="button"
                onClick={() => setStep('sessions')}
                className="mt-2 cursor-pointer text-sm text-gray-500 underline decoration-gray-300 underline-offset-2 transition hover:text-gray-900"
              >
                {campSessionText}
              </button>
            </div>
          </div>
        </div>

        {/* Price details card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900">Price details</h3>
          {!selectedSession ? (
            <p className="mt-4 text-sm text-gray-500">Select a session to see pricing</p>
          ) : selectedChildIds.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">Select at least one child to see pricing</p>
          ) : (
            <div className="mt-4 space-y-2">
              {breakdown.map(row => (
                <div
                  key={`${row.unitPrice}`}
                  className="flex items-center justify-between font-medium text-gray-700"
                >
                  <span>
                    {row.count} child{row.count === 1 ? '' : 'ren'} x
                    <span className="ml-1 text-sm">{formatCurrency(row.unitPrice, currency)}</span>
                  </span>
                  <span>{formatCurrency(row.lineTotal, currency)}</span>
                </div>
              ))}
              <div className="h-px bg-gray-200" />
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(subtotal, currency)}</span>
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
