'use client'

import { useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { CampBookingFlow } from '@/components/camp-booking/camp-booking-flow'
import { useCampBookingStore } from '@/stores/camp-booking-store'

export default function CampBookingPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const campSlug = params.campSlug as string
  const bookingGroupId = searchParams.get('bookingGroupId')
  const preselectedSessionId = searchParams.get('sessionId')

  const initByCampSlug = useCampBookingStore(state => state.initByCampSlug)
  const hydrateFromBookingGroupId = useCampBookingStore(state => state.hydrateFromBookingGroupId)
  const currentBookingGroupId = useCampBookingStore(state => state.bookingGroupId)
  const selectSession = useCampBookingStore(state => state.selectSession)
  const setStep = useCampBookingStore(state => state.setStep)
  const autoSelectEligibleChildren = useCampBookingStore(state => state.autoSelectEligibleChildren)

  // Init runs once per campSlug. The URL-cleanup effect below strips `sessionId`
  // from the URL after init, which would otherwise re-trigger this effect and
  // bounce the user from step 2 back to step 1.
  const initializedSlugRef = useRef<string | null>(null)

  useEffect(() => {
    if (!campSlug) return
    if (initializedSlugRef.current === campSlug) return
    initializedSlugRef.current = campSlug

    const initialize = async () => {
      await initByCampSlug(campSlug)
      if (preselectedSessionId) {
        selectSession(preselectedSessionId)
        // If the user arrived from the camp profile with a specific session,
        // skip step 1 and open step 2 directly — but only when we aren't about
        // to hydrate a draft, which sets its own step.
        if (!bookingGroupId) {
          const { sessions } = useCampBookingStore.getState()
          const session = sessions.find(s => s.id === preselectedSessionId)
          if (session) {
            const spotsLeft =
              session.totalSpots != null && session.bookedCount != null
                ? session.totalSpots - session.bookedCount
                : (session.totalSpots ?? null)
            const isBookable =
              session.status === 'published' && !(spotsLeft !== null && spotsLeft <= 0)
            if (isBookable) setStep('children')
          }
        }
      }
      if (bookingGroupId) {
        await hydrateFromBookingGroupId(bookingGroupId)
      } else {
        // Fresh booking: pre-select all eligible children. The store guards
        // against overwriting any existing selection.
        autoSelectEligibleChildren()
      }
    }

    initialize().catch(() => undefined)
  }, [
    campSlug,
    bookingGroupId,
    preselectedSessionId,
    initByCampSlug,
    hydrateFromBookingGroupId,
    selectSession,
    setStep,
    autoSelectEligibleChildren,
  ])

  useEffect(() => {
    if (!currentBookingGroupId) return
    if (searchParams.get('bookingGroupId') === currentBookingGroupId) return
    router.replace(`/camps/${campSlug}/book?bookingGroupId=${currentBookingGroupId}`)
  }, [currentBookingGroupId, campSlug, router, searchParams])

  useEffect(() => {
    if (!preselectedSessionId || currentBookingGroupId) return
    router.replace(`/camps/${campSlug}/book`)
  }, [preselectedSessionId, currentBookingGroupId, campSlug, router])

  return <CampBookingFlow />
}
