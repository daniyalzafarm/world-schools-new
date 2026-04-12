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
import { onboardingService } from '@/services/onboarding.services'
import type { GoogleBusinessProfile } from '@/types/onboarding'

interface CompanyInfoModalProps {
  isOpen: boolean
  onClose: () => void
  profile: GoogleBusinessProfile
  onSuccess?: () => void
}

export const CompanyInfoModal: React.FC<CompanyInfoModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSuccess,
}) => {
  const [legalCompanyName, setLegalCompanyName] = useState('')
  const [yearFounded, setYearFounded] = useState('')
  const [website, setWebsite] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setLegalCompanyName(profile.legalInfo?.legalCompanyName ?? '')
      setYearFounded(profile.legalInfo?.yearFounded?.toString() ?? '')
      setWebsite(profile.legalInfo?.website ?? '')
      setError(null)
    }
  }, [isOpen, profile])

  const handleSave = async () => {
    if (!legalCompanyName.trim()) {
      setError('Legal company name is required')
      return
    }
    const parsedYear = parseInt(yearFounded, 10)
    if (
      !yearFounded ||
      isNaN(parsedYear) ||
      parsedYear < 1800 ||
      parsedYear > new Date().getFullYear()
    ) {
      setError('Please enter a valid year founded')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onboardingService.updateCompanyDetails({
        legalCompanyName: legalCompanyName.trim(),
        yearFounded: parsedYear,
        website: website.trim() || undefined,
        legalStreetAddress: profile.legalInfo?.legalStreetAddress ?? '',
        legalAptSuite: profile.legalInfo?.legalAptSuite ?? undefined,
        legalCity: profile.legalInfo?.legalCity ?? '',
        legalStateProvince: profile.legalInfo?.legalStateProvince ?? '',
        legalPostalCode: profile.legalInfo?.legalPostalCode ?? '',
        legalCountry: profile.legalInfo?.legalCountry ?? '',
        providerPhone: profile.legalInfo?.providerPhone ?? undefined,
        providerEmail: profile.legalInfo?.providerEmail ?? undefined,
        currency: profile.legalInfo?.currency ?? '',
        timezone: profile.legalInfo?.timezone ?? '',
      })

      addToast({
        title: 'Success',
        description: 'Company information updated successfully',
        color: 'success',
      })

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update company information')
      addToast({
        title: 'Error',
        description: err.message || 'Failed to update company information',
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

  const isSaveDisabled =
    !legalCompanyName.trim() || !yearFounded || isNaN(parseInt(yearFounded, 10))

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" placement="center">
      <ModalContent>
        <ModalHeader className="text-xl font-semibold">Edit company information</ModalHeader>
        <ModalBody className="gap-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <Input
            label="Legal company name"
            labelPlacement="outside"
            placeholder="Enter legal company name"
            value={legalCompanyName}
            onValueChange={value => {
              setLegalCompanyName(value)
              if (error) setError(null)
            }}
            isRequired
            isDisabled={isSaving}
          />

          <Input
            label="Year founded"
            labelPlacement="outside"
            placeholder="e.g. 2005"
            value={yearFounded}
            onValueChange={value => {
              setYearFounded(value)
              if (error) setError(null)
            }}
            isRequired
            isDisabled={isSaving}
            type="number"
          />

          <Input
            label="Website"
            labelPlacement="outside"
            placeholder="https://example.com"
            value={website}
            onValueChange={value => {
              setWebsite(value)
              if (error) setError(null)
            }}
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
            isDisabled={isSaveDisabled}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
