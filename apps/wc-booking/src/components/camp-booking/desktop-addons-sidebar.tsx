'use client'

import { useState } from 'react'
import { formatCurrency } from '@/utils/currency'
import { CancellationPolicyModal } from '@/components/camp-booking/cancellation-policy-modal'
import { useBookingSidebarData } from '@/components/camp-booking/use-booking-sidebar-data'
import { useBookingTotals } from '@/components/camp-booking/use-booking-totals'
import { SidebarCampInfoCard } from '@/components/camp-booking/sidebar-camp-info-card'
import { SidebarTrustCard } from '@/components/camp-booking/sidebar-trust-card'
import { SidebarExtrasList } from '@/components/camp-booking/sidebar-extras-list'

export function DesktopAddonsSidebar() {
  const {
    camp,
    selectedSession,
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

  const { campFee, extrasRows, total, depositAmount } = useBookingTotals()

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

            <SidebarExtrasList extrasRows={extrasRows} currency={currency} pricePrefix="+" />

            <div className="h-px bg-gray-200" />
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>
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
        bookingTotal={total}
        depositAmount={depositAmount}
        currency={currency}
      />
    </aside>
  )
}
