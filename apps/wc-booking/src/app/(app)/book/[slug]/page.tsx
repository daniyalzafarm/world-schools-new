'use client'

import { useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { isSessionBookable } from '@world-schools/wc-utils'
import { CampBookingFlow } from '@/components/camp-booking/camp-booking-flow'
import { useCampBookingStore } from '@/stores/camp-booking-store'

export default function CampBookingPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const campSlug = params.slug as string
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
      // A draft hydration (below) sets its own session/step, so the deep-link
      // `sessionId` only applies to fresh bookings.
      if (preselectedSessionId && !bookingGroupId) {
        const { sessions } = useCampBookingStore.getState()
        const session = sessions.find(s => s.id === preselectedSessionId)
        const spotsLeft =
          session?.totalSpots != null && session.bookedCount != null
            ? session.totalSpots - session.bookedCount
            : (session?.totalSpots ?? null)
        // Reservable = bookable (published, sane dates, starts in the future) AND not
        // sold out. Only then do we pre-select and skip to step 2; a stale/past deep
        // link instead lands the user on step 1, where SessionsStep hides it.
        const isReservable =
          session != null && isSessionBookable(session) && !(spotsLeft !== null && spotsLeft <= 0)
        if (isReservable) {
          selectSession(preselectedSessionId)
          setStep('children')
        }
      }
      if (bookingGroupId) {
        await hydrateFromBookingGroupId(bookingGroupId)
        if (useCampBookingStore.getState().hasSubmitted) {
          router.replace(`/bookings/${encodeURIComponent(bookingGroupId)}`)
          return
        }
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
    router,
  ])

  useEffect(() => {
    if (!currentBookingGroupId) return
    if (searchParams.get('bookingGroupId') === currentBookingGroupId) return
    router.replace(`/book/${campSlug}?bookingGroupId=${currentBookingGroupId}`)
  }, [currentBookingGroupId, campSlug, router, searchParams])

  useEffect(() => {
    if (!preselectedSessionId || currentBookingGroupId) return
    router.replace(`/book/${campSlug}`)
  }, [preselectedSessionId, currentBookingGroupId, campSlug, router])

  return <CampBookingFlow />
}
