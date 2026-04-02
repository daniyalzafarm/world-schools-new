'use client'

import { Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react'

export interface CancellationPolicyModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  cancellationPolicy?: string | null
}

export function CancellationPolicyModal({
  isOpen,
  onOpenChange,
  cancellationPolicy,
}: CancellationPolicyModalProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>Cancellation Policy</ModalHeader>
        <ModalBody className="space-y-3 pb-4 text-sm text-gray-700">
          <p>
            {cancellationPolicy
              ? `Policy type: ${cancellationPolicy}`
              : 'Cancellation terms are set by the camp provider and shared at confirmation.'}
          </p>
          <p>
            Free cancellation windows and partial refund thresholds depend on provider policy and
            session dates.
          </p>
          <p>No payment is captured until your booking request is accepted by the camp.</p>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
