'use client'

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'

interface SubmitConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading?: boolean
}

export function SubmitConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: SubmitConfirmationDialogProps) {
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
          <h2 className="text-2xl font-bold text-foreground">Ready to Submit?</h2>
          <p className="text-sm font-normal text-default-500">
            Please review your application before final submission
          </p>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="rounded-xl border border-default-300 bg-default-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-foreground">What happens next?</h3>
              <ul className="space-y-2 text-sm text-default-500">
                <li className="flex items-start gap-2">
                  <span className="text-secondary">1.</span>
                  <span>Your application will be submitted for review</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-secondary">2.</span>
                  <span>Our team will review your information within 2-3 business days</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-secondary">3.</span>
                  <span>You'll receive an email notification with the review decision</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-secondary">4.</span>
                  <span>Once approved, you can start creating and publishing camps</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border-2 border-warning-200 bg-warning-50 p-4">
              <p className="text-sm text-default-500">
                <strong className="text-foreground">Important:</strong> After submission, you won't
                be able to edit your application until the review is complete. Make sure all
                information is accurate.
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="bordered" onPress={onClose} isDisabled={isLoading}>
            Review Again
          </Button>
          <Button
            color="primary"
            className="font-semibold"
            onPress={onConfirm}
            isLoading={isLoading}
          >
            Submit Application
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
