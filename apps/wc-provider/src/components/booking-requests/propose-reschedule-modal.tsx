'use client'

import { useState } from 'react'
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from '@heroui/react'

interface ProposeRescheduleModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called after the proposal is created so the page can refresh. */
  onProposed: () => void
  proposeReschedule: (body: {
    proposedStartDate: string
    reasonText?: string
  }) => Promise<{ ok: boolean; message?: string }>
}

/**
 * Provider proposes new programme dates for an accepted booking (Spec v2.5 §9.7).
 * Creates a pending proposal; the capture schedule recomputes only once the
 * customer consents (they're notified to review). If they decline, the original
 * dates stand — the provider then honours them or cancels.
 */
export function ProposeRescheduleModal({
  isOpen,
  onClose,
  onProposed,
  proposeReschedule,
}: ProposeRescheduleModalProps) {
  const [proposedStartDate, setProposedStartDate] = useState('')
  const [reasonText, setReasonText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setProposedStartDate('')
    setReasonText('')
    setError(null)
    setSubmitting(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!proposedStartDate) {
      setError('Pick a new start date.')
      return
    }
    setSubmitting(true)
    setError(null)
    const res = await proposeReschedule({
      proposedStartDate: new Date(proposedStartDate).toISOString(),
      reasonText: reasonText.trim() || undefined,
    })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.message ?? 'Could not propose the new dates')
      return
    }
    reset()
    onProposed()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span>Propose new programme dates</span>
          <span className="text-xs font-normal text-default-500">
            The family must agree before anything changes. Their payment schedule recomputes against
            the new start only after they consent; if they decline, the original dates stand.
          </span>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <Input
            type="date"
            label="New programme start"
            labelPlacement="outside"
            value={proposedStartDate}
            onValueChange={setProposedStartDate}
            isRequired
          />
          <Textarea
            label="Reason (shown to the family)"
            labelPlacement="outside"
            placeholder="Why the dates are changing"
            value={reasonText}
            onValueChange={setReasonText}
            minRows={2}
          />
          {error ? (
            <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {error}
            </div>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={handleClose} isDisabled={submitting}>
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isDisabled={!proposedStartDate || submitting}
            isLoading={submitting}
          >
            Send proposal
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
