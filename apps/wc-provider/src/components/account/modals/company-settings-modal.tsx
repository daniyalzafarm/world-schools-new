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
  Select,
  SelectItem,
} from '@heroui/react'
import { getCountryCode } from '@world-schools/ui-web'
import { getCurrencyName, SUPPORTED_CURRENCIES } from '@world-schools/wc-utils'
import { onboardingService } from '@/services/onboarding.services'
import type { GoogleBusinessProfile } from '@/types/onboarding'

const CURRENCIES = SUPPORTED_CURRENCIES.map(code => ({
  value: code,
  label: `${code} - ${getCurrencyName(code)}`,
}))

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
  { value: 'Europe/Zurich', label: 'Zurich (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEDT/AEST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZDT/NZST)' },
]

interface CompanySettingsModalProps {
  isOpen: boolean
  onClose: () => void
  profile: GoogleBusinessProfile
  onSuccess?: () => void
}

export const CompanySettingsModal: React.FC<CompanySettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSuccess,
}) => {
  const [currency, setCurrency] = useState('')
  const [timezone, setTimezone] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setCurrency(profile.legalInfo?.currency ?? '')
      setTimezone(profile.legalInfo?.timezone ?? '')
      setError(null)
    }
  }, [isOpen, profile])

  const handleSave = async () => {
    if (!currency) {
      setError('Currency is required')
      return
    }
    if (!timezone) {
      setError('Timezone is required')
      return
    }

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
        providerPhone: profile.legalInfo?.providerPhone ?? undefined,
        providerEmail: profile.legalInfo?.providerEmail ?? undefined,
        currency,
        timezone,
      })

      addToast({
        title: 'Success',
        description: 'Business settings updated successfully',
        color: 'success',
      })

      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update business settings')
      addToast({
        title: 'Error',
        description: err.message || 'Failed to update business settings',
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
        <ModalHeader className="text-xl font-semibold">Edit business settings</ModalHeader>
        <ModalBody className="gap-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <Select
            label="Currency"
            labelPlacement="outside"
            placeholder="Select currency"
            selectedKeys={currency ? [currency] : []}
            onSelectionChange={keys => {
              const selected = Array.from(keys)[0] as string
              setCurrency(selected)
              if (error) setError(null)
            }}
            isRequired
            isDisabled={isSaving}
          >
            {CURRENCIES.map(c => (
              <SelectItem key={c.value}>{c.label}</SelectItem>
            ))}
          </Select>

          <Select
            label="Timezone"
            labelPlacement="outside"
            placeholder="Select timezone"
            selectedKeys={timezone ? [timezone] : []}
            onSelectionChange={keys => {
              const selected = Array.from(keys)[0] as string
              setTimezone(selected)
              if (error) setError(null)
            }}
            isRequired
            isDisabled={isSaving}
          >
            {TIMEZONES.map(tz => (
              <SelectItem key={tz.value}>{tz.label}</SelectItem>
            ))}
          </Select>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={handleClose} isDisabled={isSaving}>
            Cancel
          </Button>
          <Button
            color="secondary"
            onPress={handleSave}
            isLoading={isSaving}
            isDisabled={!currency || !timezone}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
