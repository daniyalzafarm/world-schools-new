'use client'

import React, { useEffect, useState } from 'react'
import { addToast } from '@heroui/react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { profileService } from '@/services/profile.services'
import { ProfilePhotoSection } from '@/components/account/profile-photo-section'
import { InfoRow } from '@/components/account/info-row'
import { LegalNameModal } from '@/components/account/modals/legal-name-modal'
import { NationalityModal } from '@/components/account/modals/nationality-modal'
import { LanguagesModal } from '@/components/account/modals/languages-modal'

const ProfilePage = () => {
  // Profile data state
  const [profileData, setProfileData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  // Modal state
  const [modals, setModals] = useState({
    name: false,
    nationality: false,
    languages: false,
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

  const handlePhotoChange = async (file: File) => {
    // Validate file client-side
    const maxSize = 5 * 1024 * 1024 // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      addToast({
        title: 'Invalid file type',
        description: 'Please upload a JPG, PNG, or WebP image',
        color: 'danger',
      })
      return
    }

    if (file.size > maxSize) {
      addToast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB',
        color: 'danger',
      })
      return
    }

    setIsUploadingPhoto(true)
    try {
      const updatedProfile = await profileService.uploadProfilePhoto(file)
      setProfileData(updatedProfile)
      addToast({
        title: 'Success',
        description: 'Profile photo uploaded successfully',
        color: 'success',
      })
    } catch (error) {
      addToast({
        title: 'Upload failed',
        description: 'Failed to upload profile photo. Please try again.',
        color: 'danger',
      })
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handlePhotoRemove = async () => {
    if (!profileData?.profilePhotoUrl) {
      return
    }

    setIsUploadingPhoto(true)
    try {
      const updatedProfile = await profileService.deleteProfilePhoto()
      setProfileData(updatedProfile)
      addToast({
        title: 'Success',
        description: 'Profile photo removed successfully',
        color: 'success',
      })
    } catch (error) {
      addToast({
        title: 'Removal failed',
        description: 'Failed to remove profile photo. Please try again.',
        color: 'danger',
      })
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleModalSuccess = () => {
    // Reload profile data after successful update
    void loadProfile()
  }

  // Format nationality display
  const getNationalityDisplay = () => {
    const primary = profileData?.parent?.primaryNationality
    const secondary = profileData?.parent?.secondaryNationality
    if (primary && secondary) {
      return `${primary}, ${secondary}`
    }
    return primary || 'Not specified'
  }

  // Format languages display
  const getLanguagesDisplay = () => {
    const languages = profileData?.parent?.languages
    if (languages && languages.length > 0) {
      return languages.join(', ')
    }
    return 'Not specified'
  }

  if (isLoading) {
    return (
      <ProtectedRoute requireAuth={true}>
        <div className="min-h-full w-full bg-white dark:bg-gray-900">
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading profile...</p>
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
            Personal info
          </h1>
          <p className="text-base text-gray-500 dark:text-gray-400">
            This is how camps will see you on World-Camps.
          </p>
        </div>

        {/* Profile Photo Section */}
        <section className="mb-4">
          <ProfilePhotoSection
            photoUrl={profileData?.profilePhotoUrl}
            userName={`${profileData?.firstName || ''} ${profileData?.lastName || ''}`}
            onPhotoChange={handlePhotoChange}
            onPhotoRemove={handlePhotoRemove}
          />
        </section>

        {/* Personal Details Section */}
        <section>
          <div>
            <InfoRow
              label="Legal name"
              value={`${profileData?.firstName || ''} ${profileData?.lastName || ''}`}
              onEdit={() => openModal('name')}
            />
            <InfoRow
              label="Nationality"
              value={getNationalityDisplay()}
              onEdit={() => openModal('nationality')}
            />
            <InfoRow
              label="Languages spoken"
              value={getLanguagesDisplay()}
              onEdit={() => openModal('languages')}
            />
          </div>
        </section>
      </div>

      {/* Modals */}
      <LegalNameModal
        isOpen={modals.name}
        onClose={() => closeModal('name')}
        currentFirstName={profileData?.firstName}
        currentLastName={profileData?.lastName}
        onSuccess={handleModalSuccess}
      />
      <NationalityModal
        isOpen={modals.nationality}
        onClose={() => closeModal('nationality')}
        currentPrimaryNationality={profileData?.parent?.primaryNationality}
        currentSecondaryNationality={profileData?.parent?.secondaryNationality}
        onSuccess={handleModalSuccess}
      />
      <LanguagesModal
        isOpen={modals.languages}
        onClose={() => closeModal('languages')}
        currentLanguages={profileData?.parent?.languages}
        onSuccess={handleModalSuccess}
      />
    </ProtectedRoute>
  )
}

export default ProfilePage
