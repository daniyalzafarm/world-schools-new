'use client'

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { AlertCircle } from 'lucide-react'
import { formatCurrency } from '@world-schools/wc-utils'
import { ageFromDateOfBirth, formatSessionDateRange } from '@world-schools/wc-frontend-utils'
import type { ProviderBookingGroupDetail } from '@world-schools/wc-types'

interface AcceptBookingConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading?: boolean
  detail: ProviderBookingGroupDetail
}

/**
 * Confirmation gate before accepting a booking. Surfaces the
 * full booking summary AND the immediate financial consequence (parent
 * charge) so providers can never click Accept without seeing the amount
 * they're committing to take.
 *
 * Mirror of the parent's pre-request confirmation — both sides
 * of the transaction see a final summary before money moves.
 */
export function AcceptBookingConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  detail,
}: AcceptBookingConfirmationModalProps) {
  // The session name is shown on its own line below, so this is the date range
  // only — appending the name here would repeat it.
  const sessionRange = formatSessionDateRange(detail.session.startDate, detail.session.endDate)
  const formattedTotal = formatCurrency(detail.totalAmount, detail.currency)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      classNames={{
        base: 'bg-white',
        wrapper: 'z-[9999]',
        backdrop: 'z-[9998] bg-black/50',
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-secondary-500">Confirm booking acceptance</h2>
          <p className="text-sm font-normal text-gray-500">
            Review the booking before confirming — this will charge the parent.
          </p>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Camp</dt>
                  <dd className="text-right font-medium text-secondary-500">{detail.camp.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Parent</dt>
                  <dd className="text-right font-medium text-secondary-500">
                    {detail.parent.displayName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">
                    {detail.bookings.length === 1 ? 'Child' : 'Children'}
                  </dt>
                  <dd className="text-right font-medium text-secondary-500">
                    {detail.bookings
                      .map(b => {
                        const age = ageFromDateOfBirth(b.child.dateOfBirth)
                        return `${b.child.firstName}${age != null ? ` (${age})` : ''}`
                      })
                      .join(', ')}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Session</dt>
                  <dd className="text-right font-medium text-secondary-500">
                    {detail.session.name}
                    <div className="text-xs text-gray-500">{sessionRange}</div>
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-gray-200 pt-2">
                  <dt className="text-gray-500">Total</dt>
                  <dd className="text-right text-base font-bold text-secondary-500">
                    {formattedTotal}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex items-start gap-2 rounded-xl border-2 border-warning-200 bg-warning-50 p-4 text-sm text-secondary-500">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
              <p>
                The parent&apos;s card will be charged{' '}
                <strong className="font-semibold">{formattedTotal}</strong> immediately after you
                confirm. By accepting, you commit to hosting the above session — cancellation is
                subject to your cancellation policy.
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="bordered" onPress={onClose} isDisabled={isLoading}>
            Go back
          </Button>
          <Button
            radius="md"
            className="bg-primary-200 font-semibold text-secondary-500 hover:bg-primary-300"
            onPress={onConfirm}
            isLoading={isLoading}
          >
            Confirm acceptance
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
