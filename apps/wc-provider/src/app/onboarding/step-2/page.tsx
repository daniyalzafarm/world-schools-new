'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'
import { Button, Spinner } from '@heroui/react'
import { Input, PhoneInput } from '@world-schools/ui-web'
import { isValidPhoneNumber } from 'react-phone-number-input'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { TrustScoreBadge } from '../../../components/onboarding/TrustScoreBadge'
import type { ContactInfo } from '../../../types/onboarding'
import { canAccessStep, getNextAccessibleStep } from '../../../utils/onboarding-access'
import { onboardingService } from '../../../services/onboarding.services'

export default function OnboardingStep2Page() {
  const router = useRouter()
  const {
    status,
    googleBusinessProfile,
    isLoading,
    error,
    saveContactInfo,
    fetchGoogleBusinessProfile,
    clearError,
  } = useOnboardingStore()
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
      const response = await onboardingService.getContactInfo()
      if (response.success && response.data) {
        reset(response.data)
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
    // Clear any previous errors
    clearError()

    // Call the store method - it will handle errors and set them in the store's error state
    await saveContactInfo(data)

    // Get the latest error state from the store after the async operation completes
    const currentError = useOnboardingStore.getState().error

    // Only navigate if there was no error
    if (!currentError) {
      router.push('/onboarding/step-3')
    }
    // Error will be displayed by the error banner in the component
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
          <h1 className="mb-2 text-3xl font-bold leading-tight text-foreground">
            Contact & Account
          </h1>
          <p className="text-base text-default-500">
            Provide your contact details and create your account
          </p>
        </div>

        {/* Error Message - Display prominently in body */}
        {error && (
          <div className="mb-6 rounded-lg border border-danger bg-danger-50 px-4 py-3">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8">
          {/* Contact Information Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-foreground">Contact Information</h2>
              <TrustScoreBadge section="step2" maxPoints={30} />
            </div>

            {/* First Name & Last Name */}
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="First Name"
                placeholder="John"
                {...register('contactFirstName', { required: 'First name is required' })}
                isDisabled={isReadOnly}
                isRequired
                isInvalid={!!errors.contactFirstName}
                errorMessage={errors.contactFirstName?.message}
              />

              <Input
                label="Last Name"
                placeholder="Doe"
                {...register('contactLastName', { required: 'Last name is required' })}
                isDisabled={isReadOnly}
                isRequired
                isInvalid={!!errors.contactLastName}
                errorMessage={errors.contactLastName?.message}
              />
            </div>

            {/* Your Role */}
            <Input
              label="Job Title"
              placeholder="Camp Director"
              {...register('contactRole', { required: 'Job title is required' })}
              isDisabled={isReadOnly}
              isRequired
              isInvalid={!!errors.contactRole}
              errorMessage={errors.contactRole?.message}
            />

            <div className="grid gap-4 md:grid-cols-2">
              {/* Contact Email */}
              <Input
                type="email"
                label="Email"
                placeholder="john.doe@example.com"
                {...register('contactEmail', {
                  required: 'Contact email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Please enter a valid email address',
                  },
                })}
                isDisabled={isReadOnly}
                isRequired
                isInvalid={!!errors.contactEmail}
                errorMessage={errors.contactEmail?.message}
              />

              {/* Phone Number */}
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
                    label="Phone Number"
                    isRequired
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

          {/* Provider Details Section */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-foreground">Provider Details</h2>

            {/* Provider Name */}
            <Input
              label="Provider Name"
              placeholder="Summer Adventures"
              {...register('providerName', { required: 'Provider name is required' })}
              isDisabled={isReadOnly}
              isRequired
              isInvalid={!!errors.providerName}
              errorMessage={errors.providerName?.message}
            />

            {/* Provider Phone & Email */}
            <div className="grid gap-4 md:grid-cols-2">
              <Controller
                name="providerPhone"
                control={control}
                rules={{
                  validate: value =>
                    !value || isValidPhoneNumber(value) || 'Please enter a valid phone number',
                }}
                render={({ field }) => (
                  <PhoneInput
                    label="Provider Phone (Optional)"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isReadOnly}
                    error={errors.providerPhone?.message}
                    placeholder="+1 (555) 123-4567"
                  />
                )}
              />

              <Input
                type="email"
                label="Provider Email (Optional)"
                placeholder="info@example.com"
                {...register('providerEmail', {
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Please enter a valid email address',
                  },
                })}
                isDisabled={isReadOnly}
                isInvalid={!!errors.providerEmail}
                errorMessage={errors.providerEmail?.message}
              />
            </div>

            {/* Website */}
            <Input
              type="url"
              label="Website (Optional)"
              placeholder="https://example.com"
              {...register('website', {
                pattern: {
                  value: /^https?:\/\/.+/,
                  message: 'Please enter a valid URL starting with http:// or https://',
                },
              })}
              isDisabled={isReadOnly}
              isInvalid={!!errors.website}
              errorMessage={errors.website?.message}
            />
          </div>

          {/* Legal Business Information Section */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-foreground">Legal Business Information</h2>

            {/* Legal Company Name */}
            <Input
              label="Legal Company Name"
              placeholder="Adventure Camps LLC"
              {...register('legalCompanyName', { required: 'Legal company name is required' })}
              isDisabled={isReadOnly}
              isRequired
              isInvalid={!!errors.legalCompanyName}
              errorMessage={errors.legalCompanyName?.message}
            />

            <Input
              className="md:col-span-2"
              label="Street Address"
              placeholder="123 Main Street"
              {...register('legalStreetAddress', {
                required: 'Street address is required',
              })}
              isDisabled={isReadOnly}
              isRequired
              isInvalid={!!errors.legalStreetAddress}
              errorMessage={errors.legalStreetAddress?.message}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Apt/Suite (Optional)"
                placeholder="Suite 100"
                {...register('legalAptSuite')}
                isDisabled={isReadOnly}
              />
              <Input
                label="City"
                placeholder="Los Angeles"
                {...register('legalCity', { required: 'City is required' })}
                isDisabled={isReadOnly}
                isRequired
                isInvalid={!!errors.legalCity}
                errorMessage={errors.legalCity?.message}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="State/Province"
                placeholder="California"
                {...register('legalStateProvince', { required: 'State/Province is required' })}
                isDisabled={isReadOnly}
                isRequired
                isInvalid={!!errors.legalStateProvince}
                errorMessage={errors.legalStateProvince?.message}
              />
              <Input
                label="Postal Code"
                placeholder="90001"
                {...register('legalPostalCode', { required: 'Postal code is required' })}
                isDisabled={isReadOnly}
                isRequired
                isInvalid={!!errors.legalPostalCode}
                errorMessage={errors.legalPostalCode?.message}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Country"
                placeholder="United States"
                {...register('legalCountry', { required: 'Country is required' })}
                isDisabled={isReadOnly}
                isRequired
                isInvalid={!!errors.legalCountry}
                errorMessage={errors.legalCountry?.message}
              />
              <Input
                type="number"
                label="Year Founded"
                placeholder="2010"
                {...register('yearFounded', {
                  required: 'Year founded is required',
                  valueAsNumber: true,
                })}
                isDisabled={isReadOnly}
                isRequired
                isInvalid={!!errors.yearFounded}
                errorMessage={errors.yearFounded?.message}
              />
            </div>
          </div>
        </form>
      </div>
    </OnboardingPageLayout>
  )
}
