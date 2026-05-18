import { useMemo } from 'react'
import { useCampBookingStore } from '@/stores/camp-booking-store'
import {
  type AddOnExtrasRow,
  getAddOnExtrasRows,
  getSelectedChildrenSubtotal,
} from '@/components/camp-booking/booking-flow-pricing'
import { computeDepositAmount } from '@/utils/payment-plan'

export interface BookingTotals {
  campFee: number
  extrasRows: AddOnExtrasRow[]
  extrasTotal: number
  total: number
  depositAmount: number | null
}

export function useBookingTotals(): BookingTotals {
  const camp = useCampBookingStore(state => state.camp)
  const sessions = useCampBookingStore(state => state.sessions)
  const selectedSessionId = useCampBookingStore(state => state.selectedSessionId)
  const children = useCampBookingStore(state => state.children)
  const selectedChildIds = useCampBookingStore(state => state.selectedChildIds)
  const addOns = useCampBookingStore(state => state.addOns)
  const addOnSelectionsById = useCampBookingStore(state => state.addOnSelectionsById)

  const selectedSession = useMemo(
    () => sessions.find(s => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  )

  const campFee = useMemo(
    () =>
      getSelectedChildrenSubtotal({
        session: selectedSession,
        camp,
        children,
        selectedChildIds,
      }),
    [selectedSession, camp, children, selectedChildIds]
  )

  const extrasRows = useMemo(
    () => getAddOnExtrasRows({ addOns, addOnSelectionsById }),
    [addOns, addOnSelectionsById]
  )

  const extrasTotal = useMemo(
    () => extrasRows.reduce((sum, row) => sum + row.total, 0),
    [extrasRows]
  )

  const total = campFee + extrasTotal

  const depositAmount = useMemo(
    () =>
      computeDepositAmount(total, {
        depositRequired: camp?.depositRequired,
        depositType: camp?.depositType,
        depositPercentage: camp?.depositPercentage,
        depositFixedAmount: camp?.depositFixedAmount,
      }),
    [total, camp]
  )

  return { campFee, extrasRows, extrasTotal, total, depositAmount }
}
