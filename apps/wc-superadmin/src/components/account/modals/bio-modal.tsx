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
import { Textarea } from '@world-schools/ui-web'
import { profileService } from '@/services/profile.services'

const BIO_MAX_LENGTH = 2000

interface BioModalProps {
  isOpen: boolean
  onClose: () => void
  currentBio?: string | null
  onSuccess?: () => void
}

export const BioModal: React.FC<BioModalProps> = ({
  isOpen,
  onClose,
  currentBio = '',
  onSuccess,
}) => {
  const [bio, setBio] = useState(currentBio ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setBio(currentBio ?? '')
      setError(null)
    }
  }, [isOpen, currentBio])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      await profileService.updateProfile({
        bio: bio.trim(),
      })

      addToast({
        title: 'Success',
        description: 'Bio updated successfully',
        color: 'success',
      })

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update bio')
      addToast({
        title: 'Error',
        description: err.message || 'Failed to update bio',
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
    <Modal isOpen={isOpen} onClose={handleClose} size="lg" placement="center">
      <ModalContent>
        <ModalHeader className="text-xl font-semibold">Edit bio</ModalHeader>
        <ModalBody className="gap-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <Textarea
            label="Bio"
            labelPlacement="outside"
            placeholder="Tell others a bit about yourself (optional)"
            value={bio}
            onValueChange={value => {
              setBio(value)
              if (error) setError(null)
            }}
            minRows={4}
            maxLength={BIO_MAX_LENGTH}
            showCharacterCount
            isDisabled={isSaving}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={handleClose} isDisabled={isSaving}>
            Cancel
          </Button>
          <Button color="secondary" onPress={handleSave} isLoading={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
