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
import { getCountryCode, Input, PhoneInput } from '@world-schools/ui-web'
import { onboardingService } from '@/services/onboarding.services'
import type { GoogleBusinessProfile } from '@/types/onboarding'

interface CompanyContactModalProps {
  isOpen: boolean
  onClose: () => void
  profile: GoogleBusinessProfile
  onSuccess?: () => void
}

export const CompanyContactModal: React.FC<CompanyContactModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSuccess,
}) => {
  const [providerPhone, setProviderPhone] = useState('')
  const [providerEmail, setProviderEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setProviderPhone(profile.legalInfo?.providerPhone ?? '')
      setProviderEmail(profile.legalInfo?.providerEmail ?? '')
      setError(null)
    }
  }, [isOpen, profile])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      await onboardingService.updateCompanyDetails({
        legalCompanyName: profile.legalInfo?.legalCompanyName ?? '',
        yearFounded: profile.legalInfo?.yearFounded ?? new Date().getFullYear(),
        website: profile.legalInfo?.website ?? undefined,
        legalStreetAddress: profile.legalInfo?.legalStreetAddress ?? '',
        legalAptSuite: profile.legalInfo?.legalAptSuite ?? undefined,
        legalCity: profile.legalInfo?.legalCity ?? '',
        legalStateProvince: profile.legalInfo?.legalStateProvince ?? '',
        legalPostalCode: profile.legalInfo?.legalPostalCode ?? '',
        legalCountry: getCountryCode(profile.legalInfo?.legalCountry),
        providerPhone: providerPhone.trim() || undefined,
        providerEmail: providerEmail.trim() || undefined,
        currency: profile.legalInfo?.currency ?? '',
        timezone: profile.legalInfo?.timezone ?? '',
      })

      addToast({
        title: 'Success',
        description: 'Business contact updated successfully',
        color: 'success',
      })

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update business contact')
      addToast({
        title: 'Error',
        description: err.message || 'Failed to update business contact',
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
        <ModalHeader className="text-xl font-semibold">Edit business contact</ModalHeader>
        <ModalBody className="gap-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <PhoneInput
            label="Business phone (optional)"
            placeholder="Enter business phone number"
            value={providerPhone}
            onChange={value => {
              setProviderPhone(value || '')
              if (error) setError(null)
            }}
            disabled={isSaving}
            defaultCountry="US"
          />

          <Input
            label="Business email (optional)"
            labelPlacement="outside"
            placeholder="Enter business email address"
            value={providerEmail}
            onValueChange={value => {
              setProviderEmail(value)
              if (error) setError(null)
            }}
            isDisabled={isSaving}
            type="email"
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
