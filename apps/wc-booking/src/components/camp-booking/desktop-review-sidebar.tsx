'use client'

import { useMemo, useState } from 'react'
import { formatCurrency } from '@/utils/currency'
import { getChildAge } from '@/types/child'
import { CancellationPolicyModal } from '@/components/camp-booking/cancellation-policy-modal'
import { useBookingSidebarData } from '@/components/camp-booking/use-booking-sidebar-data'
import { useBookingTotals } from '@/components/camp-booking/use-booking-totals'
import { SidebarExtrasList } from '@/components/camp-booking/sidebar-extras-list'
import { SidebarRatingsRow } from '@/components/camp-booking/sidebar-camp-info-card'

export function DesktopReviewSidebar() {
  const {
    camp,
    selectedSession,
    children,
    selectedChildIds,
    addOns,
    currency,
    setStep,
    campPhotoUrl,
    beforeCancellationText: beforeCancellationLabel,
    systemRating,
    systemReviewsCount,
    hasSystemReviews,
    googleRating,
    googleReviewsCount,
    hasGoogleReviews,
    googleReviewsUrl,
  } = useBookingSidebarData()

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

  const [isCancellationOpen, setIsCancellationOpen] = useState(false)

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

  const { campFee, extrasRows, total, depositAmount } = useBookingTotals()

  return (
    <aside className="hidden lg:block sticky top-28 md:top-32">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200">
          <div className="flex gap-4">
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
              <SidebarRatingsRow
                systemRating={systemRating}
                systemReviewsCount={systemReviewsCount}
                hasSystemReviews={hasSystemReviews}
                googleRating={googleRating}
                googleReviewsCount={googleReviewsCount}
                hasGoogleReviews={hasGoogleReviews}
                googleReviewsUrl={googleReviewsUrl}
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-gray-200">
          <p className="text-sm font-bold text-gray-900">Free cancellation</p>
          <button
            type="button"
            onClick={() => setIsCancellationOpen(true)}
            className="mt-1 cursor-pointer text-left text-sm text-gray-600 transition hover:text-gray-900"
          >
            {beforeCancellationLabel ? (
              <>
                Cancel{' '}
                <span className="underline decoration-gray-300 underline-offset-3">
                  by {beforeCancellationLabel}
                </span>{' '}
                for a full refund.
              </>
            ) : (
              <span className="underline decoration-gray-300 underline-offset-3">
                View cancellation policy
              </span>
            )}
          </button>
        </div>

        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
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

        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
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

        {addOns.length > 0 && (
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
        )}

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
            <SidebarExtrasList extrasRows={extrasRows} currency={currency} />
            <div className="h-px bg-gray-200" />
            <div className="flex items-center justify-between text-lg font-bold text-gray-900">
              <span>Total due</span>
              <span>{formatCurrency(total, currency)}</span>
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
        depositAmount={depositAmount}
        currency={currency}
      />
    </aside>
  )
}
