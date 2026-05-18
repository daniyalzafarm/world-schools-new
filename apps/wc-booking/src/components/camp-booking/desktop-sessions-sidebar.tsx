'use client'

import { useState } from 'react'
import { formatCurrency } from '@/utils/currency'
import { CancellationPolicyModal } from '@/components/camp-booking/cancellation-policy-modal'
import { getSessionFallbackUnitPrice } from '@/components/camp-booking/booking-flow-pricing'
import { useBookingSidebarData } from '@/components/camp-booking/use-booking-sidebar-data'
import { SidebarCampInfoCard } from '@/components/camp-booking/sidebar-camp-info-card'
import { SidebarTrustCard } from '@/components/camp-booking/sidebar-trust-card'

export function DesktopSessionsSidebar() {
  const {
    camp,
    selectedSession,
    currency,
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

  const sessionUnitPrice = getSessionFallbackUnitPrice(selectedSession)

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
        />

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
        // Sessions step: number of children + addons aren't picked yet, so
        // we don't have a meaningful booking total. The unit-price-times-1
        // we used to pass was off by N children + addons. Pass null to make
        // the modal render percentages only — accurate at this step.
        bookingTotal={null}
        depositAmount={null}
        currency={currency}
      />
    </aside>
  )
}
