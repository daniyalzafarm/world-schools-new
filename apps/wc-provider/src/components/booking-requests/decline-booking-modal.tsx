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
import {
  BOOKING_DECLINE_REASON_LABELS,
  BookingDeclineReason,
  DECLINE_REASON_NOTE_MIN_LENGTH,
  DECLINE_REASONS_REQUIRING_NOTE,
} from '@world-schools/wc-types'

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

/**
 * Controlled list of decline reasons in display order. `note`, when present,
 * adds a contextual free-text field with its own prompt; the field is required
 * when the reason is in `DECLINE_REASONS_REQUIRING_NOTE`. All notes are private
 * to the platform — the parent only ever sees the reason label.
 */
const REASON_CONFIG: Array<{
  key: BookingDeclineReason
  note?: { label: string; placeholder: string }
}> = [
  { key: BookingDeclineReason.CapacityOrScheduling },
  {
    key: BookingDeclineReason.EligibilityCriteriaNotMet,
    note: { label: 'Which requirement?', placeholder: 'Optional — kept private to the platform' },
  },
  {
    key: BookingDeclineReason.OperationalInability,
    note: {
      label: 'Please specify the need',
      placeholder: 'Required — kept private to the platform',
    },
  },
  {
    key: BookingDeclineReason.IncompleteInformation,
    note: { label: 'What is missing?', placeholder: 'Optional — kept private to the platform' },
  },
  {
    key: BookingDeclineReason.SafeguardingConcerns,
    note: {
      label: 'Describe the safety concern',
      placeholder: 'Shared only with World Camps compliance — never shown to the parent',
    },
  },
  {
    key: BookingDeclineReason.Other,
    note: {
      label: 'Please describe the reason',
      placeholder: 'Required — kept private to the platform',
    },
  },
]

/**
 * Decline-with-reason modal (BUG-118). The controlled list comes from
 * Provider Terms v1.7 §5.1(h)(iii) — providers must select one before the
 * Decline button enables. Several reasons carry a contextual note; it is
 * required for operational-inability, safety, and "other" declines so the
 * Platform can review per §5.1(h)(iv) pattern monitoring.
 */
export function DeclineBookingModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: DeclineBookingModalProps) {
  const [reason, setReason] = useState<BookingDeclineReason | null>(null)
  const [noteText, setNoteText] = useState('')

  // Reset internal state every time the modal is reopened — otherwise the
  // previous decline's reason would persist into the next booking.
  useEffect(() => {
    if (isOpen) {
      setReason(null)
      setNoteText('')
    }
  }, [isOpen])

  const selectedConfig = REASON_CONFIG.find(opt => opt.key === reason)
  const hasNoteField = !!selectedConfig?.note
  const noteRequired = reason != null && DECLINE_REASONS_REQUIRING_NOTE.includes(reason)
  const noteSatisfied = !noteRequired || noteText.trim().length >= DECLINE_REASON_NOTE_MIN_LENGTH
  const canSubmit = reason != null && noteSatisfied && !isLoading

  const handleConfirm = () => {
    if (!reason || !canSubmit) return
    onConfirm({
      declineReason: reason,
      declineReasonOther: hasNoteField ? noteText.trim() || undefined : undefined,
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
              {REASON_CONFIG.map(opt => (
                <SelectItem key={opt.key}>{BOOKING_DECLINE_REASON_LABELS[opt.key]}</SelectItem>
              ))}
            </Select>

            {selectedConfig?.note && (
              <Textarea
                label={selectedConfig.note.label}
                labelPlacement="outside"
                minRows={3}
                value={noteText}
                onValueChange={setNoteText}
                isRequired={noteRequired}
                placeholder={selectedConfig.note.placeholder}
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
