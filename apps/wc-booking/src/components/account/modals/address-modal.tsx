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
import { profileService } from '@/services/profile.services'

interface AddressModalProps {
  isOpen: boolean
  onClose: () => void
  currentAddress?: {
    address?: string
    city?: string
    postalCode?: string
    country?: string
  }
  onSuccess?: () => void
}

export const AddressModal: React.FC<AddressModalProps> = ({
  isOpen,
  onClose,
  currentAddress,
  onSuccess,
}) => {
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAddress(currentAddress?.address || '')
      setCity(currentAddress?.city || '')
      setPostalCode(currentAddress?.postalCode || '')
      setCountry(getCountryCode(currentAddress?.country))
      setError(null)
    }
  }, [isOpen, currentAddress])

  const handleSave = async () => {
    // Validation
    if (!address.trim()) {
      setError('Street address is required')
      return
    }
    if (!city.trim()) {
      setError('City is required')
      return
    }
    // Postal code is optional — many countries don't use one.
    if (!country) {
      setError('Country is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await profileService.updateProfile({
        address: address.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        country: country,
      })

      addToast({
        title: 'Success',
        description: 'Address updated successfully',
        color: 'success',
      })

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update address')
      addToast({
        title: 'Error',
        description: err.message || 'Failed to update address',
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
        <ModalHeader className="text-xl font-semibold">Edit home address</ModalHeader>
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
            value={address}
            onValueChange={value => {
              setAddress(value)
              if (error) setError(null)
            }}
            isRequired
            isDisabled={isSaving}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="City"
              labelPlacement="outside"
              placeholder="Enter city"
              value={city}
              onValueChange={value => {
                setCity(value)
                if (error) setError(null)
              }}
              isRequired
              isDisabled={isSaving}
            />
            <Input
              label="Postal code"
              labelPlacement="outside"
              placeholder="Enter postal code"
              value={postalCode}
              onValueChange={value => {
                setPostalCode(value)
                if (error) setError(null)
              }}
              isDisabled={isSaving}
            />
          </div>

          <CountrySelect
            label="Country"
            placeholder="Search country"
            isRequired
            value={country}
            onChange={value => {
              setCountry(value)
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
            isDisabled={!address.trim() || !city.trim() || !postalCode.trim() || !country}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
