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
import { NationalitySelect } from '@world-schools/ui-web'
import { profileService } from '@/services/profile.services'

interface NationalityModalProps {
  isOpen: boolean
  onClose: () => void
  currentPrimaryNationality?: string
  currentSecondaryNationality?: string
  onSuccess?: () => void
}

export const NationalityModal: React.FC<NationalityModalProps> = ({
  isOpen,
  onClose,
  currentPrimaryNationality = '',
  currentSecondaryNationality = '',
  onSuccess,
}) => {
  const [primaryNationality, setPrimaryNationality] = useState(currentPrimaryNationality)
  const [secondaryNationality, setSecondaryNationality] = useState(currentSecondaryNationality)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPrimaryNationality(currentPrimaryNationality)
      setSecondaryNationality(currentSecondaryNationality)
      setError(null)
    }
  }, [isOpen, currentPrimaryNationality, currentSecondaryNationality])

  const handleSave = async () => {
    // Validation
    if (!primaryNationality) {
      setError('Primary nationality is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await profileService.updateProfile({
        primaryNationality,
        secondaryNationality: secondaryNationality || undefined,
      })

      addToast({
        title: 'Success',
        description: 'Nationality updated successfully',
        color: 'success',
      })

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update nationality')
      addToast({
        title: 'Error',
        description: err.message || 'Failed to update nationality',
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
        <ModalHeader className="text-xl font-semibold">Edit nationality</ModalHeader>
        <ModalBody className="gap-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <NationalitySelect
            label="Primary nationality"
            placeholder="Select primary nationality"
            isRequired
            value={primaryNationality}
            onChange={value => {
              setPrimaryNationality(value)
              if (error) setError(null)
            }}
            isDisabled={isSaving}
          />

          <NationalitySelect
            label="Secondary nationality (optional)"
            placeholder="Select secondary nationality"
            value={secondaryNationality}
            onChange={setSecondaryNationality}
            isDisabled={isSaving}
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
            isDisabled={!primaryNationality}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
