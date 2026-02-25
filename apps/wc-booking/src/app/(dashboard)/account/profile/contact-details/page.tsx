'use client'

import React, { useEffect, useState } from 'react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { profileService } from '@/services/profile.services'
import { InfoRow } from '@/components/account/info-row'
import { EmailModal } from '@/components/account/modals/email-modal'
import { PhoneModal } from '@/components/account/modals/phone-modal'
import { AddressModal } from '@/components/account/modals/address-modal'
import { Check, X } from 'lucide-react'
import { Chip } from '@heroui/react'

const ContactDetailsPage = () => {
  // Profile data state
  const [profileData, setProfileData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Modal state
  const [modals, setModals] = useState({
    email: false,
    phone: false,
    address: false,
  })

  // Load profile data on mount
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
    // Reload profile data after successful update
    void loadProfile()
  }

  // Format phone display
  const getPhoneDisplay = () => {
    const phone = profileData?.parent?.phone
    return phone || 'Not specified'
  }

  // Format address display
  const getAddressDisplay = () => {
    const parent = profileData?.parent
    if (!parent?.address && !parent?.city && !parent?.country) {
      return 'Not specified'
    }

    const parts: string[] = []
    if (parent?.address) parts.push(parent.address)
    if (parent?.city) parts.push(parent.city)
    if (parent?.postalCode) parts.push(parent.postalCode)
    if (parent?.country) parts.push(parent.country)

    return parts.join(', ')
  }

  if (isLoading) {
    return (
      <ProtectedRoute requireAuth={true}>
        <div className="min-h-full w-full bg-white dark:bg-gray-900">
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading contact details...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requireAuth={true}>
      <div className="min-h-full w-full bg-white dark:bg-gray-900">
        {/* Page Header */}
        <div className="mb-10">
          <h1 className="text-[32px] font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Contact details
          </h1>
          <p className="text-base text-gray-500 dark:text-gray-400">
            Manage your email, phone number, and address information.
          </p>
        </div>

        {/* Contact Details Section */}
        <section>
          <div>
            <InfoRow
              label="Email address"
              value={profileData?.email || 'Not specified'}
              hint="Used for booking confirmations and important updates"
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
              // onEdit={() => openModal('email')}
            />
            <InfoRow
              label="Phone number"
              value={getPhoneDisplay()}
              hint="For urgent matters and SMS notifications"
              // badge={
              //   <Chip
              //     className="h-5 text-xs"
              //     color={profileData?.phoneVerified ? 'success' : 'warning'}
              //     startContent={
              //       profileData?.phoneVerified ? (
              //         <Check className="h-3 w-3" />
              //       ) : (
              //         <X className="h-3 w-3" />
              //       )
              //     }
              //     variant="flat"
              //   >
              //     {profileData?.phoneVerified ? 'Verified' : 'Not verified'}
              //   </Chip>
              // }
              onEdit={() => openModal('phone')}
            />
            <InfoRow
              label="Home address"
              value={getAddressDisplay()}
              hint="Used for billing and to find camps near you"
              onEdit={() => openModal('address')}
            />
          </div>
        </section>
      </div>

      {/* Modals */}
      <EmailModal
        isOpen={modals.email}
        onClose={() => closeModal('email')}
        currentEmail={profileData?.email}
        onSuccess={handleModalSuccess}
      />
      <PhoneModal
        isOpen={modals.phone}
        onClose={() => closeModal('phone')}
        currentPhone={profileData?.parent?.phone}
        onSuccess={handleModalSuccess}
      />
      <AddressModal
        isOpen={modals.address}
        onClose={() => closeModal('address')}
        currentAddress={{
          address: profileData?.parent?.address,
          city: profileData?.parent?.city,
          postalCode: profileData?.parent?.postalCode,
          country: profileData?.parent?.country,
        }}
        onSuccess={handleModalSuccess}
      />
    </ProtectedRoute>
  )
}

export default ContactDetailsPage
