'use client'

import { useMemo } from 'react'
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { PROVIDER_RESPONSE_WINDOW_HOURS } from '@world-schools/wc-utils'
import { useCampBookingStore } from '@/stores/camp-booking-store'
import { getChildAge } from '@/types/child'
import { formatCurrency, getCampCurrency } from '@/utils/currency'
import { calcExtrasTotal } from '@/utils/addon-pricing'
import { getSelectedChildrenSubtotal } from '@/components/camp-booking/booking-flow-pricing'

interface BookingConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isSubmitting?: boolean
}

/**
 * Final confirmation step before a booking request is submitted. Summarises the
 * booking (camp, children, dates, total) and spells out the commitment — a
 * binding request, the provider's response window, and that the card is only
 * charged on confirmation — so the parent must actively confirm before we send
 * the request and authorise payment.
 */
export function BookingConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
}: BookingConfirmModalProps) {
  const camp = useCampBookingStore(state => state.camp)
  const sessions = useCampBookingStore(state => state.sessions)
  const selectedSessionId = useCampBookingStore(state => state.selectedSessionId)
  const children = useCampBookingStore(state => state.children)
  const selectedChildIds = useCampBookingStore(state => state.selectedChildIds)
  const addOns = useCampBookingStore(state => state.addOns)
  const addOnSelectionsById = useCampBookingStore(state => state.addOnSelectionsById)
  const currency = useCampBookingStore(state =>
    getCampCurrency(state.camp, 'booking-confirm-modal')
  )

  const session = useMemo(
    () => sessions.find(item => item.id === selectedSessionId),
    [sessions, selectedSessionId]
  )

  const childrenLabel = useMemo(
    () =>
      children
        .filter(child => selectedChildIds.includes(child.id))
        .map(child => {
          const age = getChildAge(child)
          return `${child.firstName}${age !== null ? ` (${age})` : ''}`
        })
        .join(', '),
    [children, selectedChildIds]
  )

  const dateRangeLabel = useMemo(() => {
    if (!session) return '—'
    const start = new Date(session.startDate)
    const end = new Date(session.endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return session.name
    const startFmt = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endFmt = end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    return `${startFmt} - ${endFmt}`
  }, [session])

  const total = useMemo(() => {
    const childrenSubtotal = getSelectedChildrenSubtotal({
      session,
      camp,
      children,
      selectedChildIds,
    })
    return childrenSubtotal + calcExtrasTotal(addOns, addOnSelectionsById)
  }, [session, camp, children, selectedChildIds, addOns, addOnSelectionsById])

  return (
    <Modal isOpen={isOpen} onClose={onClose} placement="center" size="lg">
      <ModalContent>
        <ModalHeader className="text-lg font-semibold text-gray-900">
          Confirm your booking request
        </ModalHeader>
        <ModalBody className="gap-4">
          <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-gray-500">Camp</dt>
              <dd className="text-right text-sm font-semibold text-gray-900">
                {camp?.name ?? 'Selected camp'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-gray-500">
                {selectedChildIds.length > 1 ? 'Children' : 'Child'}
              </dt>
              <dd className="text-right text-sm font-semibold text-gray-900">
                {childrenLabel || '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-gray-500">Dates</dt>
              <dd className="text-right text-sm font-semibold text-gray-900">{dateRangeLabel}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-gray-500">Total</dt>
              <dd className="text-right text-sm font-bold text-gray-900">
                {formatCurrency(total, currency)}
              </dd>
            </div>
          </dl>

          <ul className="space-y-2 rounded-xl bg-gray-50 p-4 text-sm leading-5 text-gray-600">
            <li>
              This sends a{' '}
              <span className="font-semibold text-gray-800">binding booking request</span> to the
              camp.
            </li>
            <li>
              The camp has{' '}
              <span className="font-semibold text-gray-800">
                {PROVIDER_RESPONSE_WINDOW_HOURS} hours
              </span>{' '}
              to confirm your booking.
            </li>
            <li>
              Your card will only be{' '}
              <span className="font-semibold text-gray-800">charged once the camp confirms</span>{' '}
              your booking.
            </li>
          </ul>
        </ModalBody>
        <ModalFooter className="flex w-full items-center justify-between">
          <Button variant="light" onPress={onClose} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button color="primary" onPress={onConfirm} isLoading={isSubmitting}>
            Confirm and submit request
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
