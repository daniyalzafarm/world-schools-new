'use client'

import { useMemo } from 'react'
import { useCampBookingStore } from '@/stores/camp-booking-store'
import { formatCurrency } from '@/utils/currency'
import { getChildAge } from '@/types/child'
import { getSelectedChildrenSubtotal } from '@/components/camp-booking/booking-flow-pricing'

export function DesktopReviewSidebar() {
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
    () => sessions.find(session => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  )
  const selectedChildren = useMemo(
    () => children.filter(child => selectedChildIds.includes(child.id)),
    [children, selectedChildIds]
  )
  const selectedChildrenLabel = selectedChildren
    .map(child => {
      const age = getChildAge(child)
      return `${child.firstName}${age !== null ? ` (${age})` : ''}`
    })
    .join(', ')
  const campPhotoUrl = useMemo(() => {
    const photos = camp?.photos ?? []
    const primary = photos.find(p => p.isPrimary)
    const chosen = primary ?? photos[0]
    return chosen?.url ?? chosen?.thumbnail ?? null
  }, [camp])

  const sessionRangeLabel = useMemo(() => {
    if (!selectedSession) return 'Select a session'
    const start = new Date(selectedSession.startDate)
    const end = new Date(selectedSession.endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return selectedSession.name
    const dayDiff = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    const weeks = Math.max(1, Math.round(dayDiff / 7))
    const startFmt = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endFmt = end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    return `${startFmt} - ${endFmt} · ${weeks} week${weeks === 1 ? '' : 's'}`
  }, [selectedSession])

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
          label: qty > 1 ? `${addon.name} x ${qty}` : addon.name,
          total: addon.price * qty,
        }
      })
      .filter(Boolean) as Array<{ key: string; label: string; total: number }>
  }, [addOnSelectionsById, addOns])

  const total = campFee + extrasRows.reduce((sum, row) => sum + row.total, 0)

  return (
    <aside className="hidden lg:block sticky top-28 md:top-32">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
              {campPhotoUrl ? (
                <img
                  src={campPhotoUrl}
                  alt={camp?.name ?? 'Camp'}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-900">{camp?.name ?? 'Camp'}</p>
              <p className="mt-1 text-sm text-gray-600">
                <span className="text-primary-600">★</span> 4.9 (241 reviews)
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-gray-200">
          <p className="text-sm font-bold text-gray-900">Free cancellation</p>
          <p className="mt-1 text-sm text-gray-600">
            Cancel before the policy window starts for a full refund.
          </p>
        </div>

        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-gray-900">Session</p>
            <p className="mt-1 text-sm text-gray-600">{sessionRangeLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => setStep('sessions')}
            className="cursor-pointer rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            Change
          </button>
        </div>

        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-gray-900">Children</p>
            <p className="mt-1 text-sm text-gray-600">{selectedChildrenLabel || 'None selected'}</p>
          </div>
          <button
            type="button"
            onClick={() => setStep('children')}
            className="cursor-pointer rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            Change
          </button>
        </div>

        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-gray-900">Add-ons</p>
            <p className="mt-1 text-sm text-gray-600">
              {extrasRows.map(row => row.label).join(', ') || 'No add-ons selected'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep('addons')}
            className="cursor-pointer rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            Change
          </button>
        </div>

        <div className="px-5 py-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Price details</h3>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Camp fee
            </div>
            <div className="flex items-center justify-between text-sm text-gray-700">
              <span>
                {selectedChildIds.length} child{selectedChildIds.length === 1 ? '' : 'ren'}
              </span>
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
                    <span>{formatCurrency(row.total, currency)}</span>
                  </div>
                ))}
              </>
            ) : null}
            <div className="h-px bg-gray-200" />
            <div className="flex items-center justify-between text-lg font-bold text-gray-900">
              <span>Total due</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
