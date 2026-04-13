'use client'

import React, { useEffect, useState } from 'react'
import { InfoRow } from '@/components/account/info-row'
import { PhoneModal } from '@/components/account/modals/phone-modal'
import { AddressModal } from '@/components/account/modals/address-modal'
import { Check, X } from 'lucide-react'
import { Chip } from '@heroui/react'
import { profileService } from '@/services/profile.services'

export default function ContactDetailsPage() {
  const [profileData, setProfileData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [modals, setModals] = useState({ phone: false, address: false })

  useEffect(() => {
    void loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setIsLoading(true)
      const profile = await profileService.getProfile()
      setProfileData(profile)
    } finally {
      setIsLoading(false)
    }
  }

  const openModal = (modalName: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [modalName]: true }))
  }

  const closeModal = (modalName: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [modalName]: false }))
  }

  const handleModalSuccess = () => {
    void loadProfile()
  }

  const getPhoneDisplay = () => {
    const phone = profileData?.phone
    return phone || 'Not specified'
  }

  const getAddressDisplay = () => {
    if (!profileData?.address && !profileData?.city && !profileData?.country) {
      return 'Not specified'
    }

    const parts: string[] = []
    if (profileData?.address) parts.push(profileData.address)
    if (profileData?.city) parts.push(profileData.city)
    if (profileData?.postalCode) parts.push(profileData.postalCode)
    if (profileData?.country) parts.push(profileData.country)

    return parts.join(', ')
  }

  if (isLoading) {
    return (
      <div className="min-h-full w-full bg-white dark:bg-gray-900">
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading contact details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full w-full bg-white dark:bg-gray-900">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Contact details
        </h1>
        <p className="text-base text-gray-500 dark:text-gray-400">
          Manage your email, phone number, and address information.
        </p>
      </div>

      <section>
        <div>
          <InfoRow
            label="Email address"
            value={profileData?.email || 'Not specified'}
            hint="Used for account notifications and important updates"
            badge={
              <Chip
                className="h-5 text-xs"
                color={profileData?.emailVerified ? 'success' : 'warning'}
                startContent={
                  profileData?.emailVerified ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <X className="h-3 w-3" />
                  )
                }
                variant="flat"
              >
                {profileData?.emailVerified ? 'Verified' : 'Not verified'}
              </Chip>
            }
          />
          <InfoRow
            label="Phone number"
            value={getPhoneDisplay()}
            hint="For urgent matters and notifications"
            onEdit={() => openModal('phone')}
          />
          <InfoRow
            label="Address"
            value={getAddressDisplay()}
            hint="Your business or contact address"
            onEdit={() => openModal('address')}
          />
        </div>
      </section>

      <PhoneModal
        isOpen={modals.phone}
        onClose={() => closeModal('phone')}
        currentPhone={profileData?.phone}
        onSuccess={handleModalSuccess}
      />
      <AddressModal
        isOpen={modals.address}
        onClose={() => closeModal('address')}
        currentAddress={{
          address: profileData?.address,
          city: profileData?.city,
          postalCode: profileData?.postalCode,
          country: profileData?.country,
        }}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}
