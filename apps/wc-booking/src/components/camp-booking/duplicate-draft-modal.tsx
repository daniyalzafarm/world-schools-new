'use client'

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import type { DraftBookingPreview } from '@/types/camp-booking'
import { formatCurrency } from '@/utils/currency'

interface DuplicateDraftModalProps {
  isOpen: boolean
  message: string
  previews: DraftBookingPreview[]
  currency: string
  onSelectDraft: (bookingGroupId: string) => void | Promise<void>
  onCreateNewBooking: () => void | Promise<void>
  onSeeDraftBookings: () => void
  onClose: () => void
}

export function DuplicateDraftModal({
  isOpen,
  message,
  previews,
  currency,
  onSelectDraft,
  onCreateNewBooking,
  onSeeDraftBookings,
  onClose,
}: DuplicateDraftModalProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={open => !open && onClose()} placement="center" size="lg">
      <ModalContent>
        <ModalHeader className="text-lg font-semibold text-gray-900">
          Existing draft found
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-gray-600">{message}</p>
          {previews.length > 0 ? (
            <div className="space-y-2">
              <p className="font-bold text-gray-900">Select existing draft booking</p>
              {previews.slice(0, 3).map(preview => (
                <button
                  key={preview.id}
                  type="button"
                  onClick={() => onSelectDraft(preview.id)}
                  className="cursor-pointer w-full rounded-lg border border-gray-200 p-3 text-left transition hover:bg-primary-50 hover:border-primary-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {preview.sessionName ?? 'Draft booking'}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {preview.childrenCount} child{preview.childrenCount === 1 ? '' : 'ren'} -
                        Updated {new Date(preview.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-gray-900">
                      {formatCurrency(preview.totalAmount, currency)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </ModalBody>
        <ModalFooter className="flex w-full items-center justify-between">
          <Button color="primary" variant="flat" onPress={onCreateNewBooking}>
            Create New Booking
          </Button>
          <Button onPress={onSeeDraftBookings} color="primary">
            See draft Bookings
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
