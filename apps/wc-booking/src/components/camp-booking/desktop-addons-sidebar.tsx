'use client'

import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { useCampBookingStore } from '@/stores/camp-booking-store'
import { formatCurrency } from '@/utils/currency'
import { getSelectedChildrenSubtotal } from '@/components/camp-booking/booking-flow-pricing'
import { CancellationPolicyModal } from '@/components/camp-booking/cancellation-policy-modal'
import { getFreeCancellationCutoffDate } from '@world-schools/wc-utils'

function formatMonthShort(date: Date) {
  return date.toLocaleString('en-US', { month: 'short' })
}

function formatBeforeLabel(date: Date) {
  return date.toLocaleString('en-US', { month: 'long', day: 'numeric' })
}

export function DesktopAddonsSidebar() {
  const camp = useCampBookingStore(state => state.camp)
  const sessions = useCampBookingStore(state => state.sessions)
  const selectedSessionId = useCampBookingStore(state => state.selectedSessionId)
  const children = useCampBookingStore(state => state.children)
  const selectedChildIds = useCampBookingStore(state => state.selectedChildIds)
  const addOns = useCampBookingStore(state => state.addOns)
  const addOnSelectionsById = useCampBookingStore(state => state.addOnSelectionsById)
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
    const cutoff = getFreeCancellationCutoffDate(
      selectedSession?.startDate,
      camp?.provider?.settings?.cancellationPolicy,
      camp?.provider?.settings?.cancellationPolicyCustom
    )
    return cutoff ? formatBeforeLabel(cutoff) : ''
  }, [selectedSession, camp])

  const campSessionText = selectedSession
    ? sessionRangeText || selectedSession.name
    : 'Select a session'

  const campFee = useMemo(
    () =>
      getSelectedChildrenSubtotal({
        session: selectedSession,
        camp,
        children,
        selectedChildIds,
      }),
    [selectedSession, camp, children, selectedChildIds]
  )

  const extrasRows = useMemo(() => {
    return Object.values(addOnSelectionsById)
      .map(selection => {
        const addon = addOns.find(a => a.addOnId === selection.addOnId)
        if (!addon) return null
        let qty = 0
        if (selection.mode === 'per_child') qty = selection.childIds?.length ?? 0
        else if (selection.mode === 'per_child_qty') {
          qty = (selection.childQuantities ?? []).reduce(
            (sum, item) => sum + (item.quantity ?? 0),
            0
          )
        } else qty = selection.quantity ?? 0
        if (qty <= 0) return null
        return {
          key: addon.addOnId,
          label: qty > 1 ? `${addon.name} × ${qty}` : addon.name,
          total: addon.price * qty,
        }
      })
      .filter(Boolean) as Array<{ key: string; label: string; total: number }>
  }, [addOnSelectionsById, addOns])

  const extrasTotal = useMemo(
    () => extrasRows.reduce((sum, row) => sum + row.total, 0),
    [extrasRows]
  )

  const total = campFee + extrasTotal

  // Hard-coded for now (provider rating can be wired later).
  const ratingValue = 4.92
  const reviewsCount = 241

  const [isCancellationOpen, setIsCancellationOpen] = useState(false)

  return (
    <aside className="hidden lg:block sticky top-28 md:top-32">
      <div className="space-y-3">
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

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900">Price details</h3>
          <div className="mt-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Camp fee
            </div>
            <div className="flex items-center justify-between text-sm text-gray-700">
              <button
                type="button"
                onClick={() => setStep('children')}
                className="cursor-pointer underline decoration-gray-300 underline-offset-2 transition hover:text-gray-900"
              >
                {selectedChildIds.length} child{selectedChildIds.length === 1 ? '' : 'ren'}
              </button>
              <span>{formatCurrency(campFee, currency)}</span>
            </div>

            {extrasRows.length > 0 ? (
              <>
                <div className="pt-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Extras
                </div>
                {extrasRows.map(row => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between text-sm text-gray-700"
                  >
                    <span>{row.label}</span>
                    <span>+{formatCurrency(row.total, currency)}</span>
                  </div>
                ))}
              </>
            ) : null}

            <div className="h-px bg-gray-200" />
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Check size={20} className="text-primary-600" />
              <p className="text-sm font-medium text-gray-900">Free cancellation</p>
              {beforeCancellationText ? (
                <button
                  type="button"
                  onClick={() => setIsCancellationOpen(true)}
                  className="cursor-pointer text-sm text-gray-600 transition hover:text-gray-900"
                >
                  ·{' '}
                  <span className="underline decoration-gray-300 underline-offset-3">
                    before {beforeCancellationText}
                  </span>
                </button>
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

      <CancellationPolicyModal
        isOpen={isCancellationOpen}
        onOpenChange={setIsCancellationOpen}
        cancellationPolicy={camp?.provider?.settings?.cancellationPolicy}
        cancellationPolicyCustom={camp?.provider?.settings?.cancellationPolicyCustom}
        sessionStartDate={selectedSession?.startDate}
        bookingTotal={total}
        currency={currency}
      />
    </aside>
  )
}
