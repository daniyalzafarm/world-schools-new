'use client'

import type { ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Progress } from '@heroui/react'
import { ArrowLeft, ChevronLeft, ShieldCheck, X } from 'lucide-react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Logo } from '@/components/layout/logo'
import { useCampBookingStore } from '@/stores/camp-booking-store'

const ALL_STEPS = ['sessions', 'children', 'addons', 'review-and-pay'] as const
type Step = (typeof ALL_STEPS)[number]

function useVisibleSteps(): readonly Step[] {
  const hasAddOns = useCampBookingStore(state => state.addOns.length > 0)
  return hasAddOns ? ALL_STEPS : (['sessions', 'children', 'review-and-pay'] as const)
}

function CampBookingStepsBar() {
  const currentStep = useCampBookingStore(state => state.currentStep)
  const steps = useVisibleSteps()
  const rawIndex = steps.indexOf(currentStep as Step)
  const stepIndex = rawIndex >= 0 ? rawIndex + 1 : 1
  const percent = Math.round((stepIndex / steps.length) * 100)

  return (
    <div className="mx-auto max-w-6xl border-gray-200 bg-white px-4 py-3 lg:px-8">
      <div className="mb-2 flex items-center justify-between text-sm font-bold uppercase text-gray-700">
        <p>
          Step {stepIndex} of {steps.length}: {currentStep}
        </p>
        <p className="text-primary-600 capitalize">{percent}% Complete</p>
      </div>
      <Progress
        classNames={{ track: 'h-2' }}
        value={percent}
        color="primary"
        size="sm"
        aria-label="Booking progress"
      />
    </div>
  )
}

export default function CampBookingLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const params = useParams()
  const campSlug = typeof params.campSlug === 'string' ? params.campSlug : ''
  const currentStep = useCampBookingStore(state => state.currentStep)
  const setStep = useCampBookingStore(state => state.setStep)
  const steps = useVisibleSteps()

  const goToPreviousStep = () => {
    const index = steps.indexOf(currentStep as Step)
    if (index > 0) {
      setStep(steps[index - 1])
      return
    }
    router.back()
  }

  const exitToCampProfile = () => {
    if (campSlug) router.push(`/camps/${campSlug}`)
    else router.back()
  }

  return (
    <ProtectedRoute requireAuth requireParentRole>
      <div className="h-screen bg-gray-50 overflow-hidden">
        {/* Keep scroll local to this route. Sticky header/steps stay visible. */}
        <div className="h-full overflow-y-auto">
          <header className="hidden lg:block sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-6xl items-center px-4 md:h-16 md:px-8">
              <button
                type="button"
                className="cursor-pointer flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-700"
                onClick={exitToCampProfile}
              >
                <ChevronLeft size={18} /> Back to camp
              </button>
              <div className="flex-1 flex justify-center min-w-0 px-3">
                <Logo showText />
              </div>
              <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 shrink-0">
                <ShieldCheck size={18} className="text-primary-600" /> Secure booking
              </p>
            </div>
            <CampBookingStepsBar />
          </header>
          <header className="lg:hidden sticky top-0 z-40 border-b border-gray-200 bg-white backdrop-blur">
            <div className="flex items-center justify-between px-4 py-3">
              <Button
                type="button"
                isIconOnly
                variant="light"
                radius="sm"
                aria-label="Back"
                onPress={goToPreviousStep}
              >
                <ArrowLeft size={18} />
              </Button>
              <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-3">
                <Logo showText />
              </div>
              <Button
                type="button"
                isIconOnly
                variant="light"
                radius="sm"
                aria-label="Close"
                onPress={exitToCampProfile}
              >
                <X size={18} />
              </Button>
            </div>
          </header>
          {children}
        </div>
      </div>
    </ProtectedRoute>
  )
}
