'use client'

import { useMemo, useState } from 'react'
import { formatCurrency } from '@/utils/currency'
import { getSelectedChildrenPriceBreakdown } from '@/components/camp-booking/booking-flow-pricing'
import { CancellationPolicyModal } from '@/components/camp-booking/cancellation-policy-modal'
import { useBookingSidebarData } from '@/components/camp-booking/use-booking-sidebar-data'
import { useBookingTotals } from '@/components/camp-booking/use-booking-totals'
import { SidebarCampInfoCard } from '@/components/camp-booking/sidebar-camp-info-card'
import { SidebarTrustCard } from '@/components/camp-booking/sidebar-trust-card'

export function DesktopChildrenSidebar() {
  const {
    camp,
    selectedSession,
    children,
    selectedChildIds,
    currency,
    setStep,
    campPhotoUrl,
    campSessionText,
    beforeCancellationText,
    systemRating,
    systemReviewsCount,
    hasSystemReviews,
    googleRating,
    googleReviewsCount,
    hasGoogleReviews,
    googleReviewsUrl,
  } = useBookingSidebarData()

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

  const { campFee: subtotal, depositAmount } = useBookingTotals()

  const [isCancellationOpen, setIsCancellationOpen] = useState(false)

  return (
    <aside className="hidden lg:block sticky top-28 md:top-32">
      <div className="space-y-3">
        <SidebarCampInfoCard
          camp={camp}
          campPhotoUrl={campPhotoUrl}
          campSessionText={campSessionText}
          systemRating={systemRating}
          systemReviewsCount={systemReviewsCount}
          hasSystemReviews={hasSystemReviews}
          googleRating={googleRating}
          googleReviewsCount={googleReviewsCount}
          hasGoogleReviews={hasGoogleReviews}
          googleReviewsUrl={googleReviewsUrl}
          onSessionClick={() => setStep('sessions')}
        />

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

        <SidebarTrustCard
          beforeCancellationText={beforeCancellationText}
          onCancellationClick={() => setIsCancellationOpen(true)}
        />
      </div>

      <CancellationPolicyModal
        isOpen={isCancellationOpen}
        onOpenChange={setIsCancellationOpen}
        cancellationPolicy={camp?.provider?.settings?.cancellationPolicy}
        cancellationPolicyCustom={camp?.provider?.settings?.cancellationPolicyCustom}
        sessionStartDate={selectedSession?.startDate}
        bookingTotal={subtotal}
        depositAmount={depositAmount}
        currency={currency}
      />
    </aside>
  )
}
