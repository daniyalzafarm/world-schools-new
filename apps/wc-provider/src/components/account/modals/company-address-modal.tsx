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
import { CountrySelect, getCountryCode, Input } from '@world-schools/ui-web'
import { onboardingService } from '@/services/onboarding.services'
import type { GoogleBusinessProfile } from '@/types/onboarding'

interface CompanyAddressModalProps {
  isOpen: boolean
  onClose: () => void
  profile: GoogleBusinessProfile
  onSuccess?: () => void
}

export const CompanyAddressModal: React.FC<CompanyAddressModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSuccess,
}) => {
  const [legalStreetAddress, setLegalStreetAddress] = useState('')
  const [legalAptSuite, setLegalAptSuite] = useState('')
  const [legalCity, setLegalCity] = useState('')
  const [legalStateProvince, setLegalStateProvince] = useState('')
  const [legalPostalCode, setLegalPostalCode] = useState('')
  const [legalCountry, setLegalCountry] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setLegalStreetAddress(profile.legalInfo?.legalStreetAddress ?? '')
      setLegalAptSuite(profile.legalInfo?.legalAptSuite ?? '')
      setLegalCity(profile.legalInfo?.legalCity ?? '')
      setLegalStateProvince(profile.legalInfo?.legalStateProvince ?? '')
      setLegalPostalCode(profile.legalInfo?.legalPostalCode ?? '')
      setLegalCountry(getCountryCode(profile.legalInfo?.legalCountry))
      setError(null)
    }
  }, [isOpen, profile])

  const handleSave = async () => {
    if (!legalStreetAddress.trim()) {
      setError('Street address is required')
      return
    }
    if (!legalCity.trim()) {
      setError('City is required')
      return
    }
    if (!legalStateProvince.trim()) {
      setError('State / Province is required')
      return
    }
    if (!legalPostalCode.trim()) {
      setError('Postal code is required')
      return
    }
    if (!legalCountry) {
      setError('Country is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onboardingService.updateCompanyDetails({
        legalCompanyName: profile.legalInfo?.legalCompanyName ?? '',
        yearFounded: profile.legalInfo?.yearFounded ?? new Date().getFullYear(),
        website: profile.legalInfo?.website ?? undefined,
        legalStreetAddress: legalStreetAddress.trim(),
        legalAptSuite: legalAptSuite.trim() || undefined,
        legalCity: legalCity.trim(),
        legalStateProvince: legalStateProvince.trim(),
        legalPostalCode: legalPostalCode.trim(),
        legalCountry,
        providerPhone: profile.legalInfo?.providerPhone ?? undefined,
        providerEmail: profile.legalInfo?.providerEmail ?? undefined,
        currency: profile.legalInfo?.currency ?? '',
        timezone: profile.legalInfo?.timezone ?? '',
      })

      addToast({
        title: 'Success',
        description: 'Business address updated successfully',
        color: 'success',
      })

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update business address')
      addToast({
        title: 'Error',
        description: err.message || 'Failed to update business address',
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
    !legalStreetAddress.trim() ||
    !legalCity.trim() ||
    !legalStateProvince.trim() ||
    !legalPostalCode.trim() ||
    !legalCountry

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" placement="center">
      <ModalContent>
        <ModalHeader className="text-xl font-semibold">Edit business address</ModalHeader>
        <ModalBody className="gap-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <Input
            label="Street address"
            labelPlacement="outside"
            placeholder="Enter street address"
            value={legalStreetAddress}
            onValueChange={value => {
              setLegalStreetAddress(value)
              if (error) setError(null)
            }}
            isRequired
            isDisabled={isSaving}
          />

          <Input
            label="Apt / Suite (optional)"
            labelPlacement="outside"
            placeholder="Enter apartment or suite number"
            value={legalAptSuite}
            onValueChange={value => {
              setLegalAptSuite(value)
            }}
            isDisabled={isSaving}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="City"
              labelPlacement="outside"
              placeholder="Enter city"
              value={legalCity}
              onValueChange={value => {
                setLegalCity(value)
                if (error) setError(null)
              }}
              isRequired
              isDisabled={isSaving}
            />
            <Input
              label="State / Province"
              labelPlacement="outside"
              placeholder="Enter state or province"
              value={legalStateProvince}
              onValueChange={value => {
                setLegalStateProvince(value)
                if (error) setError(null)
              }}
              isRequired
              isDisabled={isSaving}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Postal code"
              labelPlacement="outside"
              placeholder="Enter postal code"
              value={legalPostalCode}
              onValueChange={value => {
                setLegalPostalCode(value)
                if (error) setError(null)
              }}
              isRequired
              isDisabled={isSaving}
            />
            <CountrySelect
              label="Country"
              placeholder="Select country"
              isRequired
              value={legalCountry}
              onChange={value => {
                setLegalCountry(value)
                if (error) setError(null)
              }}
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
            isDisabled={isSaveDisabled}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
