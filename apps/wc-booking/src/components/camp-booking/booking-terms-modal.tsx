'use client'

import { Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react'

export interface BookingTermsModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function BookingTermsModal({ isOpen, onOpenChange }: BookingTermsModalProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>Booking Terms</ModalHeader>
        <ModalBody className="space-y-3 pb-4 text-sm text-gray-700">
          <p>
            By submitting this request, you authorize World Camps to send your selected details to
            the provider for confirmation.
          </p>
          <p>
            Changes to children, session, or add-ons after submission may require provider approval
            and can affect final pricing.
          </p>
          <p>World Camps acts as the booking platform; service delivery is provided by the camp.</p>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
