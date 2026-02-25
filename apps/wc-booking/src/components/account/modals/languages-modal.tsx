'use client'

import React, { useEffect, useState } from 'react'
import {
  addToast,
  Button,
  Checkbox,
  CheckboxGroup,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import { profileService } from '@/services/profile.services'

interface LanguagesModalProps {
  isOpen: boolean
  onClose: () => void
  currentLanguages?: string[]
  onSuccess?: () => void
}

// Available languages
const AVAILABLE_LANGUAGES = [
  'English',
  'French',
  'German',
  'Spanish',
  'Italian',
  'Portuguese',
  'Dutch',
  'Russian',
  'Mandarin',
  'Arabic',
]

export const LanguagesModal: React.FC<LanguagesModalProps> = ({
  isOpen,
  onClose,
  currentLanguages = [],
  onSuccess,
}) => {
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(currentLanguages)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedLanguages(currentLanguages || [])
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
    <Modal isOpen={isOpen} onClose={handleClose} size="md" placement="center">
      <ModalContent>
        <ModalHeader className="text-xl font-semibold">Edit languages spoken</ModalHeader>
        <ModalBody className="gap-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Select all languages you speak
            </p>
            <CheckboxGroup
              value={selectedLanguages}
              onValueChange={value => {
                setSelectedLanguages(value)
                if (error) setError(null)
              }}
              isDisabled={isSaving}
            >
              <div className="flex flex-col gap-3">
                {AVAILABLE_LANGUAGES.map(language => (
                  <Checkbox key={language} value={language}>
                    {language}
                  </Checkbox>
                ))}
              </div>
            </CheckboxGroup>
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
            isDisabled={selectedLanguages.length === 0}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
