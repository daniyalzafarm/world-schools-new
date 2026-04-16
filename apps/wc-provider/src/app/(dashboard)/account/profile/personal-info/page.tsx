'use client'

import React, { useEffect, useState } from 'react'
import { addToast } from '@heroui/react'
import { BackButton } from '@world-schools/ui-web'
import { profileService } from '@/services/profile.services'
import { ProfilePhotoSection } from '@/components/account/profile-photo-section'
import { InfoRow } from '@/components/account/info-row'
import { BioModal } from '@/components/account/modals/bio-modal'
import { LegalNameModal } from '@/components/account/modals/legal-name-modal'

function formatBioPreview(bio: string | null | undefined): string {
  const t = bio?.trim()
  if (!t) return 'Not set'
  return t.length > 80 ? `${t.slice(0, 80)}…` : t
}

export default function PersonalInfoPage() {
  const [profileData, setProfileData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [modals, setModals] = useState({ name: false, bio: false })

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
    const maxSize = 5 * 1024 * 1024
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
    if (!profileData?.profilePhotoUrl) return

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
    void loadProfile()
  }

  if (isLoading) {
    return (
      <div className="min-h-full w-full bg-white dark:bg-gray-900">
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full w-full bg-white dark:bg-gray-900">
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-2">
          <BackButton href="/account" />
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Personal info</h1>
        </div>
        <p className="text-base text-gray-500 dark:text-gray-400">
          This is how you appear in the provider portal.
        </p>
      </div>

      <section className="mb-4">
        <ProfilePhotoSection
          photoUrl={profileData?.profilePhotoUrl}
          userName={`${profileData?.firstName || ''} ${profileData?.lastName || ''}`}
          onPhotoChange={handlePhotoChange}
          onPhotoRemove={handlePhotoRemove}
        />
      </section>

      <section>
        <div>
          <InfoRow
            label="Legal name"
            value={`${profileData?.firstName || ''} ${profileData?.lastName || ''}`}
            onEdit={() => openModal('name')}
          />
          <InfoRow
            label="Bio"
            value={formatBioPreview(profileData?.bio)}
            onEdit={() => openModal('bio')}
          />
        </div>
      </section>

      <LegalNameModal
        isOpen={modals.name}
        onClose={() => closeModal('name')}
        currentFirstName={profileData?.firstName}
        currentLastName={profileData?.lastName}
        onSuccess={handleModalSuccess}
      />
      <BioModal
        isOpen={modals.bio}
        onClose={() => closeModal('bio')}
        currentBio={profileData?.bio}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}
