'use client'

import { useEffect, useState } from 'react'
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
} from '@heroui/react'
import { BOOKING_DECLINE_REASON_LABELS, BookingDeclineReason } from '@world-schools/wc-types'

export interface DeclinePayload {
  declineReason: BookingDeclineReason
  declineReasonOther?: string
}

interface DeclineBookingModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (payload: DeclinePayload) => void
  isLoading?: boolean
}

const REASON_OPTIONS: Array<{ key: BookingDeclineReason; label: string }> = [
  {
    key: BookingDeclineReason.CapacityOrScheduling,
    label: BOOKING_DECLINE_REASON_LABELS[BookingDeclineReason.CapacityOrScheduling],
  },
  {
    key: BookingDeclineReason.EligibilityCriteriaNotMet,
    label: BOOKING_DECLINE_REASON_LABELS[BookingDeclineReason.EligibilityCriteriaNotMet],
  },
  {
    key: BookingDeclineReason.OperationalInability,
    label: BOOKING_DECLINE_REASON_LABELS[BookingDeclineReason.OperationalInability],
  },
  {
    key: BookingDeclineReason.SafeguardingConcerns,
    label: BOOKING_DECLINE_REASON_LABELS[BookingDeclineReason.SafeguardingConcerns],
  },
  {
    key: BookingDeclineReason.Other,
    label: BOOKING_DECLINE_REASON_LABELS[BookingDeclineReason.Other],
  },
]

/**
 * Decline-with-reason modal (BUG-112). The controlled list comes from
 * Provider Terms v1.5 §5.1(h)(iii) — providers must select one before the
 * Decline button enables. "Other" requires a free-text justification so the
 * Platform can review per §5.1(h)(iv) pattern monitoring.
 */
export function DeclineBookingModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: DeclineBookingModalProps) {
  const [reason, setReason] = useState<BookingDeclineReason | null>(null)
  const [otherText, setOtherText] = useState('')

  // Reset internal state every time the modal is reopened — otherwise the
  // previous decline's reason would persist into the next booking.
  useEffect(() => {
    if (isOpen) {
      setReason(null)
      setOtherText('')
    }
  }, [isOpen])

  const isOther = reason === BookingDeclineReason.Other
  const canSubmit = reason != null && (!isOther || otherText.trim().length > 0) && !isLoading

  const handleConfirm = () => {
    if (!reason) return
    onConfirm({
      declineReason: reason,
      declineReasonOther: isOther ? otherText.trim() : undefined,
    })
  }

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
          <h2 className="text-xl font-bold text-secondary-500">Decline this request?</h2>
          <p className="text-sm font-normal text-gray-500">
            The parent will be notified and any payment authorisation released.
          </p>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <Select
              label="Reason for declining"
              labelPlacement="outside"
              placeholder="Select a reason"
              selectedKeys={reason ? [reason] : []}
              onSelectionChange={keys => {
                const next = Array.from(keys)[0] as BookingDeclineReason | undefined
                setReason(next ?? null)
              }}
              isRequired
              classNames={{
                label: 'text-sm text-gray-500',
                trigger: 'rounded-lg border border-gray-200 bg-white shadow-none',
              }}
            >
              {REASON_OPTIONS.map(opt => (
                <SelectItem key={opt.key}>{opt.label}</SelectItem>
              ))}
            </Select>

            {isOther && (
              <Textarea
                label="Please describe the reason"
                labelPlacement="outside"
                minRows={3}
                value={otherText}
                onValueChange={setOtherText}
                isRequired
                placeholder="Required when selecting Other — kept private to the platform for review"
                classNames={{
                  label: 'text-sm text-gray-500',
                  inputWrapper: 'rounded-lg border border-gray-200 bg-white shadow-none',
                  input: 'text-secondary-500',
                }}
              />
            )}

            <p className="text-xs text-gray-500">
              Reasons are recorded for compliance monitoring per the Provider Agreement and may be
              reviewed by World-Camps.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="bordered" onPress={onClose} isDisabled={isLoading}>
            Cancel
          </Button>
          <Button
            color="danger"
            variant="solid"
            onPress={handleConfirm}
            isDisabled={!canSubmit}
            isLoading={isLoading}
          >
            Decline
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
