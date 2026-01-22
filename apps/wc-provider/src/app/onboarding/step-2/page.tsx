'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'
import { Button, Spinner } from '@heroui/react'
import { PhoneInput } from '@world-schools/ui-web'
import { isValidPhoneNumber } from 'react-phone-number-input'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { TrustScoreBadge } from '../../../components/onboarding/TrustScoreBadge'
import type { ContactInfo } from '../../../types/onboarding'
import { canAccessStep, getNextAccessibleStep } from '../../../utils/onboarding-access'
import { onboardingService } from '../../../services/onboarding.services'

export default function OnboardingStep2Page() {
  const router = useRouter()
  const { status, googleBusinessProfile, isLoading, error, saveContactInfo, fetchGoogleBusinessProfile } =
    useOnboardingStore()
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
    control,
  } = useForm<ContactInfo>()

  // Check if onboarding is completed (read-only mode)
  const isReadOnly = status?.isCompleted ?? false

  // Route protection: Check if user can access Step 2
  useEffect(() => {
    if (status && !canAccessStep(2, status)) {
      const nextStep = getNextAccessibleStep(status)
      router.push(nextStep)
    }
  }, [status, router])

  // Fetch Google Business Profile and saved contact info
  useEffect(() => {
    const loadData = async () => {
      await fetchGoogleBusinessProfile()
      // Load saved contact info
      const savedInfo = await onboardingService.getContactInfo()
      if (savedInfo) {
        reset(savedInfo)
      }
    }
    void loadData()
  }, [fetchGoogleBusinessProfile, reset])

  // Auto-fill legal business information when profile is loaded (only if not already saved)
  useEffect(() => {
    if (googleBusinessProfile) {
      // Only auto-fill if fields are empty
      const currentLegalName = document.querySelector<HTMLInputElement>(
        'input[name="legalCompanyName"]'
      )?.value
      if (!currentLegalName) {
        setValue('legalCompanyName' as any, googleBusinessProfile.businessName || '')

        // Auto-fill address fields
        const streetAddress = [googleBusinessProfile.streetNumber, googleBusinessProfile.streetName]
          .filter(Boolean)
          .join(' ')

        if (streetAddress) {
          setValue('legalStreetAddress' as any, streetAddress)
        } else if (googleBusinessProfile.formattedAddress) {
          setValue('legalStreetAddress' as any, googleBusinessProfile.formattedAddress)
        }

        if (googleBusinessProfile.city) {
          setValue('legalCity' as any, googleBusinessProfile.city)
        }

        if (googleBusinessProfile.state) {
          setValue('legalStateProvince' as any, googleBusinessProfile.state)
        }

        if (googleBusinessProfile.postalCode) {
          setValue('legalPostalCode' as any, googleBusinessProfile.postalCode)
        }

        if (googleBusinessProfile.country) {
          setValue('legalCountry' as any, googleBusinessProfile.country)
        }
      }
    }
  }, [googleBusinessProfile, setValue])

  const onSubmit = async (data: ContactInfo) => {
    await saveContactInfo(data)
    router.push('/onboarding/step-3')
  }

  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <OnboardingPageLayout
      breadcrumb="Provider Onboarding / Contact & Account"
      footer={
        <div className="flex items-center justify-between">
          <Button variant="light" onPress={() => router.push('/onboarding/step-1')}>
            ← Back
          </Button>
          <Button
            color="primary"
            size="lg"
            onPress={() =>
              isReadOnly ? router.push('/onboarding/step-3') : handleSubmit(onSubmit)()
            }
            isLoading={isLoading}
          >
            {isReadOnly ? 'Next →' : 'Save & Continue →'}
          </Button>
        </div>
      }
    >
      {/* Content */}
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-[32px] font-bold leading-tight text-foreground">
            Contact & Account
          </h1>
          <p className="text-[16px] text-default-500">
            Provide your contact details and create your account
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-danger-200 bg-danger-50 p-4">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Contact Information Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <h2 className="text-[20px] font-semibold text-foreground">Contact Information</h2>
              <TrustScoreBadge section="step2" maxPoints={30} />
            </div>

            {/* First Name & Last Name */}
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">
                  First Name
                  <span className="ml-1 text-danger">*</span>
                </label>
                <input
                  type="text"
                  placeholder="John"
                  {...register('contactFirstName', { required: 'First name is required' })}
                  disabled={isReadOnly}
                  className="w-full rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500"
                />
                {errors.contactFirstName && (
                  <p className="mt-1 text-sm text-danger">{errors.contactFirstName.message}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">
                  Last Name
                  <span className="ml-1 text-danger">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Doe"
                  {...register('contactLastName', { required: 'Last name is required' })}
                  disabled={isReadOnly}
                  className="w-full rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500"
                />
                {errors.contactLastName && (
                  <p className="mt-1 text-sm text-danger">{errors.contactLastName.message}</p>
                )}
              </div>
            </div>

            {/* Your Role */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">
                Job Title
                <span className="ml-1 text-danger">*</span>
              </label>
              <input
                type="text"
                placeholder="Camp Director"
                {...register('contactRole', { required: 'Job title is required' })}
                disabled={isReadOnly}
                className="w-full rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500"
              />
              {errors.contactRole && (
                <p className="mt-1 text-sm text-danger">{errors.contactRole.message}</p>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Contact Email */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">
                  Email
                  <span className="ml-1 text-danger">*</span>
                </label>
                <input
                  type="email"
                  placeholder="john.doe@example.com"
                  {...register('contactEmail', {
                    required: 'Contact email is required',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Please enter a valid email address',
                    },
                  })}
                  disabled={isReadOnly}
                  className="w-full rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500"
                />
                {errors.contactEmail && (
                  <p className="mt-1 text-sm text-danger">{errors.contactEmail.message}</p>
                )}
              </div>

              {/* Phone Number */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">
                  Phone Number
                  <span className="ml-1 text-danger">*</span>
                </label>
                <Controller
                  name="contactPhone"
                  control={control}
                  rules={{
                    required: 'Phone number is required',
                    validate: value =>
                      !value || isValidPhoneNumber(value) || 'Please enter a valid phone number',
                  }}
                  render={({ field }) => (
                    <PhoneInput
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isReadOnly}
                      error={errors.contactPhone?.message}
                      placeholder="(555) 123-4567"
                    />
                  )}
                />
              </div>
            </div>
          </div>

          {/* Provider Details Section */}
          <div className="space-y-6">
            <h2 className="text-[20px] font-semibold text-foreground">Provider Details</h2>

            {/* Provider Name */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">
                Provider Name
                <span className="ml-1 text-danger">*</span>
              </label>
              <input
                type="text"
                placeholder="Summer Adventures"
                {...register('providerName', { required: 'Provider name is required' })}
                disabled={isReadOnly}
                className="w-full rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500"
              />
              {errors.providerName && (
                <p className="mt-1 text-sm text-danger">{errors.providerName.message}</p>
              )}
            </div>

            {/* Provider Phone & Email */}
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">
                  Provider Phone (Optional)
                </label>
                <Controller
                  name="providerPhone"
                  control={control}
                  rules={{
                    validate: value =>
                      !value || isValidPhoneNumber(value) || 'Please enter a valid phone number',
                  }}
                  render={({ field }) => (
                    <PhoneInput
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isReadOnly}
                      error={errors.providerPhone?.message}
                      placeholder="+1 (555) 123-4567"
                    />
                  )}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">
                  Provider Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="info@example.com"
                  {...register('providerEmail', {
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Please enter a valid email address',
                    },
                  })}
                  disabled={isReadOnly}
                  className="w-full rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500"
                />
                {errors.providerEmail && (
                  <p className="mt-1 text-sm text-danger">{errors.providerEmail.message}</p>
                )}
              </div>
            </div>

            {/* Website */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">
                Website (Optional)
              </label>
              <input
                type="url"
                placeholder="https://example.com"
                {...register('website', {
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: 'Please enter a valid URL starting with http:// or https://',
                  },
                })}
                disabled={isReadOnly}
                className="w-full rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500"
              />
              {errors.website && (
                <p className="mt-1 text-sm text-danger">{errors.website.message}</p>
              )}
            </div>
          </div>

          {/* Legal Business Information Section */}
          <div className="space-y-6">
            <h2 className="text-[20px] font-semibold text-foreground">
              Legal Business Information
            </h2>

            {/* Legal Company Name */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">
                Legal Company Name
                <span className="ml-1 text-danger">*</span>
              </label>
              <input
                type="text"
                placeholder="Adventure Camps LLC"
                {...register('legalCompanyName', { required: 'Legal company name is required' })}
                disabled={isReadOnly}
                className="w-full rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500"
              />
              {errors.legalCompanyName && (
                <p className="mt-1 text-sm text-danger">{errors.legalCompanyName.message}</p>
              )}
            </div>

            {/* Street Address & Apt/Suite */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-foreground">
                  Street Address
                  <span className="ml-1 text-danger">*</span>
                </label>
                <input
                  type="text"
                  placeholder="123 Main Street"
                  {...register('legalStreetAddress', {
                    required: 'Street address is required',
                  })}
                  disabled={isReadOnly}
                  className="w-full rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500"
                />
                {errors.legalStreetAddress && (
                  <p className="mt-1 text-sm text-danger">{errors.legalStreetAddress.message}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">
                  Apt/Suite (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Suite 100"
                  {...register('legalAptSuite')}
                  disabled={isReadOnly}
                  className="w-full rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500"
                />
              </div>
            </div>

            {/* City & State */}
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">
                  City
                  <span className="ml-1 text-danger">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Los Angeles"
                  {...register('legalCity', { required: 'City is required' })}
                  disabled={isReadOnly}
                  className="w-full rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500"
                />
                {errors.legalCity && (
                  <p className="mt-1 text-sm text-danger">{errors.legalCity.message}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">
                  State/Province
                  <span className="ml-1 text-danger">*</span>
                </label>
                <input
                  type="text"
                  placeholder="California"
                  {...register('legalStateProvince', { required: 'State/Province is required' })}
                  disabled={isReadOnly}
                  className="w-full rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500"
                />
                {errors.legalStateProvince && (
                  <p className="mt-1 text-sm text-danger">{errors.legalStateProvince.message}</p>
                )}
              </div>
            </div>

            {/* Postal Code & Country */}
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">
                  Postal Code
                  <span className="ml-1 text-danger">*</span>
                </label>
                <input
                  type="text"
                  placeholder="90001"
                  {...register('legalPostalCode', { required: 'Postal code is required' })}
                  disabled={isReadOnly}
                  className="w-full rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500"
                />
                {errors.legalPostalCode && (
                  <p className="mt-1 text-sm text-danger">{errors.legalPostalCode.message}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">
                  Country
                  <span className="ml-1 text-danger">*</span>
                </label>
                <input
                  type="text"
                  placeholder="United States"
                  {...register('legalCountry', { required: 'Country is required' })}
                  disabled={isReadOnly}
                  className="w-full rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500"
                />
                {errors.legalCountry && (
                  <p className="mt-1 text-sm text-danger">{errors.legalCountry.message}</p>
                )}
              </div>
            </div>

            {/* Year Founded */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">
                Year Founded
                <span className="ml-1 text-danger">*</span>
              </label>
              <input
                type="number"
                placeholder="2010"
                {...register('yearFounded', {
                  required: 'Year founded is required',
                  valueAsNumber: true,
                })}
                disabled={isReadOnly}
                className="w-full rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500"
              />
              {errors.yearFounded && (
                <p className="mt-1 text-sm text-danger">{errors.yearFounded.message}</p>
              )}
            </div>
          </div>
        </form>
      </div>
    </OnboardingPageLayout>
  )
}
