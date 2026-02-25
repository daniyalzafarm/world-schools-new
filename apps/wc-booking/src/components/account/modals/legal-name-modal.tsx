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
import { Input } from '@world-schools/ui-web'
import { profileService } from '@/services/profile.services'

interface LegalNameModalProps {
  isOpen: boolean
  onClose: () => void
  currentFirstName?: string
  currentLastName?: string
  onSuccess?: () => void
}

export const LegalNameModal: React.FC<LegalNameModalProps> = ({
  isOpen,
  onClose,
  currentFirstName = '',
  currentLastName = '',
  onSuccess,
}) => {
  const [firstName, setFirstName] = useState(currentFirstName)
  const [lastName, setLastName] = useState(currentLastName)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFirstName(currentFirstName)
      setLastName(currentLastName)
      setError(null)
    }
  }, [isOpen, currentFirstName, currentLastName])

  const handleSave = async () => {
    // Validation
    if (!firstName.trim()) {
      setError('First name is required')
      return
    }
    if (!lastName.trim()) {
      setError('Last name is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await profileService.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      })

      addToast({
        title: 'Success',
        description: 'Legal name updated successfully',
        color: 'success',
      })

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update legal name')
      addToast({
        title: 'Error',
        description: err.message || 'Failed to update legal name',
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
        <ModalHeader className="text-xl font-semibold">Edit legal name</ModalHeader>
        <ModalBody className="gap-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First name"
              labelPlacement="outside"
              placeholder="Enter first name"
              value={firstName}
              onValueChange={value => {
                setFirstName(value)
                if (error) setError(null)
              }}
              isRequired
              isDisabled={isSaving}
            />
            <Input
              label="Last name"
              labelPlacement="outside"
              placeholder="Enter last name"
              value={lastName}
              onValueChange={value => {
                setLastName(value)
                if (error) setError(null)
              }}
              isRequired
              isDisabled={isSaving}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={handleClose} isDisabled={isSaving}>
            Cancel
          </Button>
          <Button
            color="secondary"
            onPress={handleSave}
            isLoading={isSaving}
            isDisabled={!firstName.trim() || !lastName.trim()}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
