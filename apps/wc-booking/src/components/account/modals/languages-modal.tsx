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
import { getLanguageCode, LanguageSelect } from '@world-schools/ui-web'
import { profileService } from '@/services/profile.services'

interface LanguagesModalProps {
  isOpen: boolean
  onClose: () => void
  currentLanguages?: string[]
  onSuccess?: () => void
}

export const LanguagesModal: React.FC<LanguagesModalProps> = ({
  isOpen,
  onClose,
  currentLanguages = [],
  onSuccess,
}) => {
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(currentLanguages)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens (normalize legacy names/ids to canonical codes)
  useEffect(() => {
    if (isOpen) {
      setSelectedLanguages((currentLanguages || []).map(lang => getLanguageCode(lang) || lang))
      setError(null)
    }
  }, [isOpen])

  const handleSave = async () => {
    // Validation - at least one language should be selected
    if (selectedLanguages.length === 0) {
      setError('Please select at least one language')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await profileService.updateProfile({
        languages: selectedLanguages,
      })

      addToast({
        title: 'Success',
        description: 'Languages updated successfully',
        color: 'success',
      })

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update languages')
      addToast({
        title: 'Error',
        description: err.message || 'Failed to update languages',
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
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      placement="center"
      // The language picker renders its dropdown in a portal on document.body;
      // HeroUI would treat a click on a portaled option as an outside press and
      // dismiss the modal, so disable interact-outside close (X + Cancel still close it).
      isDismissable={false}
    >
      <ModalContent>
        <ModalHeader className="text-xl font-semibold">Edit languages spoken</ModalHeader>
        <ModalBody className="gap-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <LanguageSelect
            label="Select all languages you speak"
            value={selectedLanguages}
            onChange={value => {
              setSelectedLanguages(value)
              if (error) setError(null)
            }}
            isDisabled={isSaving}
            placeholder="Add language"
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
            isDisabled={selectedLanguages.length === 0}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
