'use client'

import { useEffect } from 'react'
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

  useEffect(() => {
    if (!campSlug) return

    const initialize = async () => {
      await initByCampSlug(campSlug)
      if (preselectedSessionId) {
        selectSession(preselectedSessionId)
      }
      if (bookingGroupId) {
        await hydrateFromBookingGroupId(bookingGroupId)
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
