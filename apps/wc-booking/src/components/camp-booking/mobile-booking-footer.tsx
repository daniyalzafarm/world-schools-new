'use client'

import { Button } from '@heroui/react'
import { useMemo } from 'react'
import { useCampBookingStore } from '@/stores/camp-booking-store'
import { formatCurrency } from '@/utils/currency'
import type { Session } from '@/types/sessions'

function getSessionPrice(session: Session | null | undefined) {
  if (!session) return 0
  if (session.pricingType === 'single') return Number(session.price ?? 0)
  if (session.pricingType === 'age_group') {
    const prices = session.ageGroupPrices ?? []
    return prices.length ? Math.min(...prices.map(p => Number(p.price ?? 0))) : 0
  }
  return 0
}

function StepBars({ currentStep }: { currentStep: string }) {
  const bars = useMemo(() => {
    const mk = (done: boolean, active: boolean) => ({
      done,
      active,
    })

    switch (currentStep) {
      case 'sessions':
        return [mk(false, true), mk(false, false), mk(false, false), mk(false, false)]
      case 'children':
        return [mk(true, false), mk(false, true), mk(false, false), mk(false, false)]
      case 'addons':
        return [mk(true, false), mk(true, false), mk(false, true), mk(false, false)]
      case 'review-and-pay':
        return [mk(true, false), mk(true, false), mk(true, false), mk(false, true)]
      default:
        return [mk(false, true), mk(false, false), mk(false, false), mk(false, false)]
    }
  }, [currentStep])

  return (
    <div className="step-progress flex gap-1">
      {bars.map((b, idx) => (
        <div
          key={idx}
          className={[
            'h-1 flex-1 rounded-[2px]',
            b.done ? 'bg-emerald-500' : '',
            b.active ? 'bg-gray-900' : '',
            !b.done && !b.active ? 'bg-gray-200' : '',
          ].join(' ')}
        />
      ))}
    </div>
  )
}

export function MobileBookingFooter() {
  const currentStep = useCampBookingStore(state => state.currentStep)
  const isLoading = useCampBookingStore(state => state.isLoading)
  const hasSubmitted = useCampBookingStore(state => state.hasSubmitted)

  const sessions = useCampBookingStore(state => state.sessions)
  const selectedSessionId = useCampBookingStore(state => state.selectedSessionId)
  const selectedSession = useMemo(
    () => sessions.find(s => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  )

  const children = useCampBookingStore(state => state.children)
  const selectedChildIds = useCampBookingStore(state => state.selectedChildIds)

  const currency = useCampBookingStore(state => state.camp?.provider?.settings?.currency ?? 'EUR')
  const setStep = useCampBookingStore(state => state.setStep)
  const createDraftBookingGroup = useCampBookingStore(state => state.createDraftBookingGroup)
  const saveAddOnsAndGoToReview = useCampBookingStore(state => state.saveAddOnsAndGoToReview)
  const submitBookingGroup = useCampBookingStore(state => state.submitBookingGroup)

  const selectedChildren = useMemo(
    () => children.filter(c => selectedChildIds.includes(c.id)),
    [children, selectedChildIds]
  )

  const sessionPrice = getSessionPrice(selectedSession)
  const childrenSubtotal = sessionPrice * selectedChildren.length

  const onMainPress = async () => {
    if (isLoading) return

    if (currentStep === 'sessions') {
      setStep('children')
      return
    }

    if (currentStep === 'children') {
      // createDraftBookingGroup will also set currentStep to `addons`.
      await createDraftBookingGroup()
      return
    }

    if (currentStep === 'addons') {
      await saveAddOnsAndGoToReview()
      return
    }

    if (currentStep === 'review-and-pay') {
      await submitBookingGroup()
    }
  }

  const isDisabled =
    isLoading ||
    (currentStep === 'sessions' && !selectedSessionId) ||
    (currentStep === 'children' && selectedChildIds.length === 0) ||
    (currentStep === 'review-and-pay' && hasSubmitted)

  const label =
    currentStep === 'sessions'
      ? 'Continue'
      : currentStep === 'children'
        ? 'Continue'
        : currentStep === 'addons'
          ? 'Continue'
          : 'Request to book'

  return (
    <div className="mobile-footer mobile-only fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white px-4 py-4 lg:hidden">
      <div className="flex flex-col gap-4">
        {(currentStep === 'sessions' || currentStep === 'children') &&
        (currentStep === 'sessions' ? !!selectedSession : selectedChildren.length > 0) ? (
          <div className="flex justify-between items-center gap-3">
            <div className="min-w-0">
              <div className="text-sm text-gray-500">
                {currentStep === 'sessions' ? 'Selected Session' : 'Selected Children'}
              </div>
              <div className="text-lg font-bold text-gray-900 truncate">
                {currentStep === 'sessions'
                  ? selectedSession?.name
                  : `${selectedChildren.length} child${selectedChildren.length === 1 ? '' : 'ren'}`}
              </div>
            </div>
            <div className="text-lg font-bold text-gray-900 whitespace-nowrap">
              {currentStep === 'sessions'
                ? formatCurrency(sessionPrice, currency)
                : formatCurrency(childrenSubtotal, currency)}
            </div>
          </div>
        ) : null}

        <StepBars currentStep={currentStep} />

        <Button color="primary" className="w-full" isDisabled={isDisabled} onPress={onMainPress}>
          {label}
        </Button>
      </div>
    </div>
  )
}
