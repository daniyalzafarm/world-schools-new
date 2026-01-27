'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'
import { Input, Textarea } from '@world-schools/ui-web'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { OnboardingFooter } from '../../../components/onboarding/OnboardingFooter'
import { TrustScoreBadge } from '../../../components/onboarding/TrustScoreBadge'
import { canAccessStep, getNextAccessibleStep } from '../../../utils/onboarding-access'
import { onboardingService } from '../../../services/onboarding.services'

export default function OnboardingStep3Page() {
  const router = useRouter()
  const { status, isLoading, saveCampInfo } = useOnboardingStore()
  const [description, setDescription] = useState('')
  const [campTypes, setCampTypes] = useState<string[]>([])

  // Track original data and changes
  const [originalDescription, setOriginalDescription] = useState('')
  const [originalCampTypes, setOriginalCampTypes] = useState<string[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const charCount = description.length
  const isDescriptionValid = charCount >= 100 && charCount <= 300

  // Check if onboarding is completed (read-only mode)
  const isReadOnly = status?.isCompleted ?? false

  // Load saved camp info
  useEffect(() => {
    const loadCampInfo = async () => {
      const response = await onboardingService.getCampInfo()
      if (response.success && response.data) {
        setDescription(response.data.description)
        setCampTypes(response.data.campTypes)
        setOriginalDescription(response.data.description)
        setOriginalCampTypes(response.data.campTypes)
      }
    }
    void loadCampInfo()
  }, [])

  // Detect form changes
  useEffect(() => {
    const hasChanges =
      description !== originalDescription ||
      JSON.stringify(campTypes.sort()) !== JSON.stringify(originalCampTypes.sort())

    setHasUnsavedChanges(hasChanges)
  }, [description, campTypes, originalDescription, originalCampTypes])

  // Route protection: Check if user can access Step 3
  useEffect(() => {
    if (status && !canAccessStep(3, status)) {
      const nextStep = getNextAccessibleStep(status)
      router.push(nextStep)
    }
  }, [status, router])

  const toggleCampType = (type: string) => {
    if (isReadOnly) return // Prevent changes in read-only mode
    setCampTypes(prev => (prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]))
  }

  const handleContinue = async () => {
    await saveCampInfo({
      description,
      campTypes,
    })
    // Store will handle errors and set them in error state
    // Only navigate if no error occurred
    router.push('/onboarding/verification')
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
      breadcrumb="Provider Onboarding / About Your Camp"
      footer={
        <OnboardingFooter
          onNext={async () => {
            if (isReadOnly || !hasUnsavedChanges) {
              // No changes or read-only mode - navigate directly without saving
              router.push('/onboarding/verification')
            } else {
              // Has unsaved changes - save first, then navigate
              await handleContinue()
            }
          }}
          isLoading={isLoading}
          isDisabled={
            !isReadOnly && hasUnsavedChanges && (!isDescriptionValid || campTypes.length === 0)
          }
          nextButtonText={isReadOnly || !hasUnsavedChanges ? 'Next →' : 'Save & Continue →'}
        />
      }
    >
      {/* Content */}
      <div>
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-3xl font-bold leading-tight text-foreground">About your camp</h1>
            <TrustScoreBadge section="step3" maxPoints={10} />
          </div>
          <p className="text-base text-default-500">
            Help us understand your programs so we can review your application
          </p>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-8">
          {/* Brief Description */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-foreground">Brief Description</h2>

            <Textarea
              aria-label="Brief Description"
              isRequired
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Tell us about your camp programs, specialty, and what makes you unique..."
              maxLength={300}
              minLength={100}
              isDisabled={isReadOnly}
              description="Helps our team understand your camp during review"
              minRows={4}
              showCharacterCount
            />
          </div>

          {/* Camp Type */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-foreground">Camp Type</h2>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Day Camp */}
              <button
                type="button"
                onClick={() => toggleCampType('day')}
                disabled={isReadOnly}
                className={`cursor-pointer flex items-center gap-4 rounded-xl border p-5 text-left transition-all ${
                  campTypes.includes('day')
                    ? 'border-primary bg-primary-50'
                    : 'border-default-200 hover:border-default-500'
                } ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <div className="text-3xl">☀️</div>
                <div className="flex-1">
                  <div className="mb-1 font-semibold text-foreground">Day Camp</div>
                  <div className="text-sm text-default-500">Campers go home daily</div>
                </div>
              </button>

              {/* Overnight Camp */}
              <button
                type="button"
                onClick={() => toggleCampType('overnight')}
                disabled={isReadOnly}
                className={`cursor-pointer flex items-center gap-4 rounded-xl border p-5 text-left transition-all ${
                  campTypes.includes('overnight')
                    ? 'border-primary bg-primary-50'
                    : 'border-default-200 hover:border-default-500'
                } ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <div className="text-3xl">🌙</div>
                <div className="flex-1">
                  <div className="mb-1 font-semibold text-foreground">Overnight Camp</div>
                  <div className="text-sm text-default-500">Campers stay overnight</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </OnboardingPageLayout>
  )
}
