'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addToast } from '@heroui/react'
import { BackButton, getCountryName } from '@world-schools/ui-web'
import { InfoRow } from '@/components/account/info-row'
import { CompanyInfoModal } from '@/components/account/modals/company-info-modal'
import { CompanyAddressModal } from '@/components/account/modals/company-address-modal'
import { CompanyContactModal } from '@/components/account/modals/company-contact-modal'
import { CompanySettingsModal } from '@/components/account/modals/company-settings-modal'
import { ProviderLogoSection } from '@/components/account/provider-logo-section'
import { onboardingService } from '@/services/onboarding.services'
import { useAuth } from '@/hooks/use-auth'
import type { GoogleBusinessProfile } from '@/types/onboarding'

const TIMEZONES: Record<string, string> = {
  'America/New_York': 'Eastern Time (ET)',
  'America/Chicago': 'Central Time (CT)',
  'America/Denver': 'Mountain Time (MT)',
  'America/Los_Angeles': 'Pacific Time (PT)',
  'America/Anchorage': 'Alaska Time (AKT)',
  'Pacific/Honolulu': 'Hawaii Time (HT)',
  'Europe/London': 'London (GMT/BST)',
  'Europe/Paris': 'Paris (CET/CEST)',
  'Europe/Berlin': 'Berlin (CET/CEST)',
  'Europe/Rome': 'Rome (CET/CEST)',
  'Europe/Madrid': 'Madrid (CET/CEST)',
  'Europe/Zurich': 'Zurich (CET/CEST)',
  'Asia/Tokyo': 'Tokyo (JST)',
  'Asia/Shanghai': 'Shanghai (CST)',
  'Asia/Hong_Kong': 'Hong Kong (HKT)',
  'Asia/Singapore': 'Singapore (SGT)',
  'Asia/Dubai': 'Dubai (GST)',
  'Australia/Sydney': 'Sydney (AEDT/AEST)',
  'Australia/Melbourne': 'Melbourne (AEDT/AEST)',
  'Pacific/Auckland': 'Auckland (NZDT/NZST)',
}

export default function CompanyDetailsPage() {
  const router = useRouter()
  const { isProviderAdmin } = useAuth()
  const [profile, setProfile] = useState<GoogleBusinessProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [modals, setModals] = useState({
    companyInfo: false,
    address: false,
    contact: false,
    settings: false,
  })

  useEffect(() => {
    if (!isProviderAdmin) {
      router.replace('/account')
      return
    }
    void loadProfile()
  }, [isProviderAdmin])

  const loadProfile = async () => {
    try {
      setIsLoading(true)
      const [profileResult, logoResult] = await Promise.all([
        onboardingService.getGoogleBusinessProfile(),
        onboardingService.getProviderLogo(),
      ])
      if (profileResult.success) {
        setProfile(profileResult.data ?? null)
      }
      if (logoResult.success) {
        setLogoUrl(logoResult.data?.logoUrl ?? null)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogoChange = async (file: File) => {
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

    setIsUploadingLogo(true)
    try {
      const result = await onboardingService.uploadProviderLogo(file)
      if (result.success && result.data) {
        setLogoUrl(result.data.logoUrl)
        addToast({
          title: 'Success',
          description: 'Logo uploaded successfully',
          color: 'success',
        })
      }
    } catch {
      addToast({
        title: 'Upload failed',
        description: 'Failed to upload logo. Please try again.',
        color: 'danger',
      })
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleLogoRemove = async () => {
    setIsUploadingLogo(true)
    try {
      await onboardingService.deleteProviderLogo()
      setLogoUrl(null)
      addToast({
        title: 'Success',
        description: 'Logo removed successfully',
        color: 'success',
      })
    } catch {
      addToast({
        title: 'Removal failed',
        description: 'Failed to remove logo. Please try again.',
        color: 'danger',
      })
    } finally {
      setIsUploadingLogo(false)
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

  const getAddressDisplay = () => {
    const info = profile?.legalInfo
    if (!info?.legalStreetAddress && !info?.legalCity && !info?.legalCountry) {
      return 'Not set'
    }
    const parts: string[] = []
    if (info?.legalStreetAddress) parts.push(info.legalStreetAddress)
    if (info?.legalAptSuite) parts.push(info.legalAptSuite)
    if (info?.legalCity) parts.push(info.legalCity)
    if (info?.legalStateProvince) parts.push(info.legalStateProvince)
    if (info?.legalPostalCode) parts.push(info.legalPostalCode)
    if (info?.legalCountry) parts.push(getCountryName(info.legalCountry))
    return parts.join(', ')
  }

  const getTimezoneLabel = (value: string | null | undefined) => {
    if (!value) return 'Not set'
    return TIMEZONES[value] ?? value
  }

  if (isLoading) {
    return (
      <div className="min-h-full w-full bg-white dark:bg-gray-900">
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading company details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full w-full bg-white dark:bg-gray-900">
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-2">
          <BackButton href="/account" />
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
            Company Details
          </h1>
        </div>
        <p className="text-base text-gray-500 dark:text-gray-400">
          Manage your business information and legal company details.
        </p>
      </div>

      <section className="mb-8">
        <ProviderLogoSection
          logoUrl={logoUrl}
          providerName={profile?.legalInfo?.legalCompanyName ?? 'Provider'}
          onLogoChange={handleLogoChange}
          onLogoRemove={handleLogoRemove}
        />
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">
          Company Information
        </h2>
        <div>
          <InfoRow
            label="Legal company name"
            value={profile?.legalInfo?.legalCompanyName || 'Not set'}
            onEdit={() => openModal('companyInfo')}
          />
          <InfoRow
            label="Year founded"
            value={profile?.legalInfo?.yearFounded?.toString() || 'Not set'}
            onEdit={() => openModal('companyInfo')}
          />
          <InfoRow
            label="Website"
            value={profile?.legalInfo?.website || 'Not set'}
            onEdit={() => openModal('companyInfo')}
          />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">
          Business Address
        </h2>
        <div>
          <InfoRow
            label="Address"
            value={getAddressDisplay()}
            onEdit={() => openModal('address')}
          />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">
          Business Contact
        </h2>
        <div>
          <InfoRow
            label="Business phone"
            value={profile?.legalInfo?.providerPhone || 'Not set'}
            onEdit={() => openModal('contact')}
          />
          <InfoRow
            label="Business email"
            value={profile?.legalInfo?.providerEmail || 'Not set'}
            onEdit={() => openModal('contact')}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">
          Business Settings
        </h2>
        <div>
          <InfoRow
            label="Currency"
            value={profile?.legalInfo?.currency || 'Not set'}
            onEdit={() => openModal('settings')}
          />
          <InfoRow
            label="Timezone"
            value={getTimezoneLabel(profile?.legalInfo?.timezone)}
            onEdit={() => openModal('settings')}
          />
        </div>
      </section>

      {profile && (
        <>
          <CompanyInfoModal
            isOpen={modals.companyInfo}
            onClose={() => closeModal('companyInfo')}
            profile={profile}
            onSuccess={handleModalSuccess}
          />
          <CompanyAddressModal
            isOpen={modals.address}
            onClose={() => closeModal('address')}
            profile={profile}
            onSuccess={handleModalSuccess}
          />
          <CompanyContactModal
            isOpen={modals.contact}
            onClose={() => closeModal('contact')}
            profile={profile}
            onSuccess={handleModalSuccess}
          />
          <CompanySettingsModal
            isOpen={modals.settings}
            onClose={() => closeModal('settings')}
            profile={profile}
            onSuccess={handleModalSuccess}
          />
        </>
      )}
    </div>
  )
}
