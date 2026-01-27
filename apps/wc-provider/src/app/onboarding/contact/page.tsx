'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'
import { Spinner } from '@heroui/react'
import { Input, PhoneInput, SelectField } from '@world-schools/ui-web'
import { isValidPhoneNumber } from 'react-phone-number-input'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { OnboardingFooter } from '../../../components/onboarding/OnboardingFooter'
import { TrustScoreBadge } from '../../../components/onboarding/TrustScoreBadge'
import type { ContactInfo } from '../../../types/onboarding'
import { canAccessStep, getNextAccessibleStep } from '../../../utils/onboarding-access'
import { onboardingService } from '../../../services/onboarding.services'

export default function OnboardingStep2Page() {
  const router = useRouter()
  // Use selective subscription to prevent unnecessary re-renders
  const status = useOnboardingStore(state => state.status)
  const isLoading = useOnboardingStore(state => state.isLoading)
  const error = useOnboardingStore(state => state.error)
  const saveContactInfo = useOnboardingStore(state => state.saveContactInfo)
  const clearError = useOnboardingStore(state => state.clearError)

  const {
    handleSubmit,
    formState: { errors },
    reset,
    control,
    watch,
  } = useForm<ContactInfo>()

  // Check if onboarding is completed (read-only mode)
  const isReadOnly = status?.isCompleted ?? false

  // Track original data and changes
  const [originalData, setOriginalData] = useState<ContactInfo | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Custom job title for "Other" option
  const [customJobTitle, setCustomJobTitle] = useState('')

  // Job title options
  const JOB_TITLE_OPTIONS = [
    'Owner / Director',
    'Camp Manager',
    'Administrator',
    'Marketing / Sales',
    'Other',
  ] as const

  // Watch all form fields for changes
  const formData = watch()

  // Determine if custom job title input should be shown
  // Show when: "Other" is selected OR role is a custom value not in predefined options
  // Note: Visibility is independent of read-only mode - the input's isDisabled prop handles that
  const showCustomJobTitleInput =
    formData.contactRole &&
    (formData.contactRole === 'Other' || !JOB_TITLE_OPTIONS.includes(formData.contactRole as any))

  // Route protection: Check if user can access Step 1
  useEffect(() => {
    if (status && !canAccessStep(1, status)) {
      const nextStep = getNextAccessibleStep(status)
      router.push(nextStep)
    }
  }, [status, router])

  // Fetch saved contact info
  useEffect(() => {
    const loadData = async () => {
      const response = await onboardingService.getContactInfo()
      if (response.success && response.data) {
        const savedData = response.data

        // Check if the saved role is a custom value (not in predefined options)
        const isCustomRole =
          savedData.contactRole && !JOB_TITLE_OPTIONS.includes(savedData.contactRole as any)

        if (isCustomRole) {
          // If it's a custom role, set the dropdown to "Other" and populate custom field
          reset({
            ...savedData,
            contactRole: 'Other',
          })
          setCustomJobTitle(savedData.contactRole)
        } else {
          reset(savedData)
        }

        setOriginalData(savedData)
      }
    }
    void loadData()
  }, [reset])

  // Detect form changes
  useEffect(() => {
    if (!originalData || !formData) return

    // Determine the effective role value (considering custom job title)
    const effectiveRole =
      formData.contactRole === 'Other' && customJobTitle.trim()
        ? customJobTitle.trim()
        : formData.contactRole

    // Compare current form data with original data
    const hasChanges =
      formData.contactFirstName !== originalData.contactFirstName ||
      formData.contactLastName !== originalData.contactLastName ||
      effectiveRole !== originalData.contactRole ||
      formData.contactPhone !== originalData.contactPhone ||
      formData.contactEmail !== originalData.contactEmail

    setHasUnsavedChanges(hasChanges)
  }, [formData, originalData, customJobTitle])

  const onSubmit = async (data: ContactInfo) => {
    // Clear any previous errors
    clearError()

    // Determine the final role value
    const finalRole =
      data.contactRole === 'Other' && customJobTitle.trim()
        ? customJobTitle.trim()
        : data.contactRole

    // Call the store method with the final role value
    await saveContactInfo({
      ...data,
      contactRole: finalRole,
    })

    // Get the latest error state from the store after the async operation completes
    const currentError = useOnboardingStore.getState().error

    // Only navigate if there was no error
    if (!currentError) {
      router.push('/onboarding/find-your-camp')
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
        <OnboardingFooter
          onNext={async () => {
            if (isReadOnly || !hasUnsavedChanges) {
              // No changes or read-only mode - navigate directly without saving
              router.push('/onboarding/find-your-camp')
            } else {
              // Has unsaved changes - save first, then navigate
              await handleSubmit(onSubmit)()
              // Check if there was an error after submission
              const currentError = useOnboardingStore.getState().error
              if (!currentError) {
                router.push('/onboarding/find-your-camp')
              }
            }
          }}
          isLoading={isLoading}
          nextButtonText={isReadOnly || !hasUnsavedChanges ? 'Next →' : 'Save & Continue →'}
        />
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
              <Controller
                name="contactFirstName"
                control={control}
                rules={{ required: 'First name is required' }}
                render={({ field }) => (
                  <Input
                    label="First Name"
                    placeholder="John"
                    value={field.value || ''}
                    onChange={e => field.onChange(e.target.value)}
                    isDisabled={isReadOnly}
                    isRequired
                    isInvalid={!!errors.contactFirstName}
                    errorMessage={errors.contactFirstName?.message}
                  />
                )}
              />

              <Controller
                name="contactLastName"
                control={control}
                rules={{ required: 'Last name is required' }}
                render={({ field }) => (
                  <Input
                    label="Last Name"
                    placeholder="Doe"
                    value={field.value || ''}
                    onChange={e => field.onChange(e.target.value)}
                    isDisabled={isReadOnly}
                    isRequired
                    isInvalid={!!errors.contactLastName}
                    errorMessage={errors.contactLastName?.message}
                  />
                )}
              />
            </div>

            {/* Job Title & Custom Job Title */}
            <div className={showCustomJobTitleInput ? 'grid gap-4 md:grid-cols-2' : ''}>
              <Controller
                name="contactRole"
                control={control}
                rules={{ required: 'Job title is required' }}
                render={({ field }) => (
                  <div className="flex flex-col gap-2">
                    <SelectField
                      label="Job Title"
                      placeholder="Select Job Title"
                      value={field.value || ''}
                      onChange={value => {
                        field.onChange(value)
                        // Clear custom job title when switching away from "Other"
                        if (value !== 'Other') {
                          setCustomJobTitle('')
                        }
                      }}
                      options={JOB_TITLE_OPTIONS}
                      isDisabled={isReadOnly}
                      isRequired
                      disallowEmptySelection
                    />
                    {errors.contactRole && (
                      <span className="text-xs text-danger">{errors.contactRole.message}</span>
                    )}
                  </div>
                )}
              />

              {/* Show custom job title input when "Other" is selected or custom role is loaded */}
              {showCustomJobTitleInput && (
                <Input
                  label="Other Job Title"
                  placeholder="Please specify your job title"
                  value={customJobTitle}
                  onChange={e => setCustomJobTitle(e.target.value)}
                  isDisabled={isReadOnly}
                />
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Contact Email */}
              <Controller
                name="contactEmail"
                control={control}
                rules={{
                  required: 'Contact email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Please enter a valid email address',
                  },
                }}
                render={({ field }) => (
                  <Input
                    type="email"
                    label="Email"
                    placeholder="john.doe@example.com"
                    value={field.value || ''}
                    onChange={e => field.onChange(e.target.value)}
                    isDisabled={isReadOnly}
                    isRequired
                    isInvalid={!!errors.contactEmail}
                    errorMessage={errors.contactEmail?.message}
                  />
                )}
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
        </form>
      </div>
    </OnboardingPageLayout>
  )
}
