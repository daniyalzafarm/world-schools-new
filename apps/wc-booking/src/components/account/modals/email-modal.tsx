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
import { contactService } from '@/services/contact.services'

interface EmailModalProps {
  isOpen: boolean
  onClose: () => void
  currentEmail?: string
  onSuccess?: () => void
}

export const EmailModal: React.FC<EmailModalProps> = ({
  isOpen,
  onClose,
  currentEmail = '',
  onSuccess,
}) => {
  const [newEmail, setNewEmail] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setNewEmail('')
      setError(null)
    }
  }, [isOpen])

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSendVerification = async () => {
    // Validation
    if (!newEmail.trim()) {
      setError('New email address is required')
      return
    }

    if (!validateEmail(newEmail)) {
      setError('Please enter a valid email address')
      return
    }

    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setError('New email must be different from current email')
      return
    }

    setIsSending(true)
    setError(null)

    try {
      await contactService.requestEmailChange(newEmail.trim())

      addToast({
        title: 'Verification email sent',
        description: 'Please check your inbox and click the verification link',
        color: 'success',
      })

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to send verification email')
      addToast({
        title: 'Error',
        description: err.message || 'Failed to send verification email',
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
        <ModalHeader className="text-xl font-semibold">Change email address</ModalHeader>
        <ModalBody className="gap-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <Input
            label="Current email"
            labelPlacement="outside"
            value={currentEmail}
            isDisabled
            className="opacity-60"
          />

          <Input
            label="New email address"
            labelPlacement="outside"
            placeholder="Enter new email address"
            type="email"
            value={newEmail}
            onValueChange={value => {
              setNewEmail(value)
              if (error) setError(null)
            }}
            isRequired
            isDisabled={isSending}
          />

          <p className="text-sm text-gray-500 dark:text-gray-400">
            We'll send a verification link to your new email address. Click the link to confirm the
            change.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={handleClose} isDisabled={isSending}>
            Cancel
          </Button>
          <Button
            color="secondary"
            onPress={handleSendVerification}
            isLoading={isSending}
            isDisabled={!newEmail.trim()}
          >
            {isSending ? 'Sending...' : 'Send verification'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
