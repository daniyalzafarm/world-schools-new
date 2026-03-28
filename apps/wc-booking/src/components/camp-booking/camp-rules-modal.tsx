'use client'

import { Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react'

export interface CampRulesModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function CampRulesModal({ isOpen, onOpenChange }: CampRulesModalProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>Camp Rules</ModalHeader>
        <ModalBody className="space-y-3 pb-4 text-sm text-gray-700">
          <p>Campers should respect staff, other campers, and follow the daily schedule.</p>
          <p>
            Parents must provide accurate health and emergency information before the session
            starts.
          </p>
          <p>
            Prohibited items and behavior are defined by the camp provider and may result in
            dismissal.
          </p>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
