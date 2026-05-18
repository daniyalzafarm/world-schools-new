import { useMemo } from 'react'
import { getFreeCancellationCutoffDate } from '@world-schools/wc-utils'
import { useCampBookingStore } from '@/stores/camp-booking-store'
import {
  formatCancellationCutoffLabel,
  formatSessionRangeShort,
} from '@/components/camp-booking/booking-flow-format'
import { useBookingRatings } from '@/components/camp-booking/use-booking-ratings'

export function useBookingSidebarData() {
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
    () => sessions.find(s => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  )

  const campPhotoUrl = useMemo(() => {
    const photos = camp?.photos ?? []
    const primary = photos.find(p => p.isPrimary)
    const chosen = primary ?? photos[0]
    return chosen?.url ?? chosen?.thumbnail ?? null
  }, [camp])

  const sessionRangeText = useMemo(
    () => formatSessionRangeShort(selectedSession),
    [selectedSession]
  )

  const beforeCancellationText = useMemo(() => {
    const cutoff = getFreeCancellationCutoffDate(
      selectedSession?.startDate,
      camp?.provider?.settings?.cancellationPolicy,
      camp?.provider?.settings?.cancellationPolicyCustom
    )
    return cutoff ? formatCancellationCutoffLabel(cutoff) : ''
  }, [selectedSession, camp])

  const campSessionText = selectedSession
    ? sessionRangeText || selectedSession.name
    : 'Select a session'

  const ratings = useBookingRatings()

  return {
    camp,
    sessions,
    selectedSession,
    children,
    selectedChildIds,
    addOns,
    addOnSelectionsById,
    currency,
    setStep,
    campPhotoUrl,
    sessionRangeText,
    beforeCancellationText,
    campSessionText,
    ...ratings,
  }
}
