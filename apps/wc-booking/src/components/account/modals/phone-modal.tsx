'use client'

import React, { useEffect, useState } from 'react'
import {
  addToast,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import { PhoneInput } from '@world-schools/ui-web'
import { contactService } from '@/services/contact.services'

interface PhoneModalProps {
  isOpen: boolean
  onClose: () => void
  currentPhone?: string
  onSuccess?: () => void
}

export const PhoneModal: React.FC<PhoneModalProps> = ({
  isOpen,
  onClose,
  currentPhone = '',
  onSuccess,
}) => {
  const [phoneNumber, setPhoneNumber] = useState<string>('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhoneNumber('')
      setError(null)
    }
  }, [isOpen])

  const handleVerifyNumber = async () => {
    // Validation
    if (!phoneNumber) {
      setError('Phone number is required')
      return
    }

    setIsSending(true)
    setError(null)

    try {
      // Send phone number in E.164 format (e.g., "+41791234567")
      await contactService.requestPhoneChange(phoneNumber)

      addToast({
        title: 'Success',
        description: 'Phone number saved successfully!',
        color: 'success',
      })

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code')
      addToast({
        title: 'Error',
        description: err.message || 'Failed to send verification code',
        color: 'danger',
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleClose = () => {
    if (!isSending) {
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" placement="center">
      <ModalContent>
        <ModalHeader className="text-xl font-semibold">Change phone number</ModalHeader>
        <ModalBody className="gap-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {currentPhone && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                Current phone
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{currentPhone}</p>
            </div>
          )}

          <PhoneInput
            label="New phone number"
            placeholder="Enter phone number"
            value={phoneNumber}
            onChange={value => {
              setPhoneNumber(value || '')
              if (error) setError(null)
            }}
            disabled={isSending}
            defaultCountry="CH"
            isRequired
            error={error || undefined}
          />

          {/* <p className="text-sm text-gray-500 dark:text-gray-400">
            We'll send a verification code to this number via SMS.
          </p> */}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={handleClose} isDisabled={isSending}>
            Cancel
          </Button>
          <Button
            color="secondary"
            onPress={handleVerifyNumber}
            isLoading={isSending}
            isDisabled={!phoneNumber}
          >
            {isSending ? 'Saving...' : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
