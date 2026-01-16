'use client'

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { AlertTriangle } from 'lucide-react'

interface DeleteSessionDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  sessionName: string
  bookingCount?: number
  isDeleting?: boolean
}

/**
 * Delete Session Confirmation Dialog
 * Shows warning and booking impact before deleting a session
 * Reference: Design flex-session-4.3.png
 */
export function DeleteSessionDialog({
  isOpen,
  onClose,
  onConfirm,
  sessionName,
  bookingCount = 0,
  isDeleting = false,
}: DeleteSessionDialogProps) {
  const hasBookings = bookingCount > 0

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-danger-100 dark:bg-danger-900 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-danger-600 dark:text-danger-400" />
            </div>
            <span className="text-[20px] font-bold text-default-900">Delete Session?</span>
          </div>
        </ModalHeader>

        <ModalBody className="space-y-4">
          {/* Session Name */}
          <div className="bg-default-100 dark:bg-default-800 rounded-lg p-3">
            <p className="text-[14px] text-default-600 mb-1">Session to delete:</p>
            <p className="text-[16px] font-semibold text-default-900">{sessionName}</p>
          </div>

          {/* Warning based on booking status */}
          {hasBookings ? (
            <div className="bg-danger-50 dark:bg-danger-950 border border-danger-200 dark:border-danger-800 rounded-lg p-4">
              <p className="text-[14px] font-semibold text-danger-900 dark:text-danger-100 mb-2">
                ⚠️ Cannot Delete - Active Bookings
              </p>
              <p className="text-[13px] text-danger-700 dark:text-danger-300 leading-relaxed">
                This session has{' '}
                <span className="font-semibold">
                  {bookingCount} active {bookingCount === 1 ? 'booking' : 'bookings'}
                </span>
                . You cannot delete a session with existing bookings. Please contact support if you
                need to cancel this session.
              </p>
            </div>
          ) : (
            <div className="bg-warning-50 dark:bg-warning-950 border border-warning-200 dark:border-warning-800 rounded-lg p-4">
              <p className="text-[14px] font-semibold text-warning-900 dark:text-warning-100 mb-2">
                ⚠️ This action cannot be undone
              </p>
              <p className="text-[13px] text-warning-700 dark:text-warning-300 leading-relaxed">
                Deleting this session will permanently remove it from your camp. This action cannot
                be reversed.
              </p>
            </div>
          )}

          {/* Additional info for sessions without bookings */}
          {!hasBookings && (
            <div className="space-y-2">
              <p className="text-[13px] text-default-600">
                Are you sure you want to delete this session?
              </p>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="flat" onPress={onClose} isDisabled={isDeleting}>
            Cancel
          </Button>
          {!hasBookings && (
            <Button
              color="danger"
              onPress={onConfirm}
              isLoading={isDeleting}
              className="font-semibold"
            >
              Delete Session
            </Button>
          )}
          {hasBookings && (
            <Button color="primary" onPress={onClose} className="font-semibold">
              Got It
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
