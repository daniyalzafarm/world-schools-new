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
import { profileService } from '@/services/profile.services'

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
  const [phoneNumber, setPhoneNumber] = useState<string>(currentPhone ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setPhoneNumber(currentPhone ?? '')
      setError(null)
    }
  }, [isOpen, currentPhone])

  const handleSave = async () => {
    const trimmed = (phoneNumber ?? '').trim()
    if (!trimmed) {
      setError('Phone number is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await profileService.updateProfile({
        phone: trimmed,
      })

      addToast({
        title: 'Success',
        description: 'Phone number updated successfully',
        color: 'success',
      })

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update phone number')
      addToast({
        title: 'Error',
        description: err.message || 'Failed to update phone number',
        color: 'danger',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    if (!isSaving) {
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
            label="Phone number"
            placeholder="Enter phone number"
            value={phoneNumber ?? ''}
            onChange={value => {
              setPhoneNumber(value || '')
              if (error) setError(null)
            }}
            disabled={isSaving}
            defaultCountry="CH"
            isRequired
            error={error || undefined}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={handleClose} isDisabled={isSaving}>
            Cancel
          </Button>
          <Button
            color="secondary"
            onPress={handleSave}
            isLoading={isSaving}
            isDisabled={!(phoneNumber ?? '').trim()}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
