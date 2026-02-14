'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { OnboardingFooter } from '../../../components/onboarding/OnboardingFooter'
import { TrustScoreBadge } from '../../../components/onboarding/TrustScoreBadge'
import type { CancellationPolicy, SaveProviderSettingsRequest } from '../../../types/onboarding'
import { canAccessStep, getNextAccessibleStep } from '../../../utils/onboarding-access'
import { onboardingService } from '../../../services/onboarding.services'

const POLICY_TEMPLATES = [
  {
    value: 'flexible' as CancellationPolicy,
    title: 'Flexible',
    description: 'Full refund if cancelled 7+ days before start',
    details: [
      '7+ days before: 100% refund',
      '3-6 days before: 50% refund',
      'Less than 3 days: No refund',
    ],
  },
  {
    value: 'moderate' as CancellationPolicy,
    title: 'Moderate',
    description: 'Full refund if cancelled 14+ days before start',
    details: [
      '14+ days before: 100% refund',
      '7-13 days before: 50% refund',
      'Less than 7 days: No refund',
    ],
  },
  {
    value: 'strict' as CancellationPolicy,
    title: 'Strict',
    description: 'Full refund if cancelled 30+ days before start',
    details: [
      '30+ days before: 100% refund',
      '14-29 days before: 50% refund',
      'Less than 14 days: No refund',
    ],
  },
]

export default function OnboardingStep6CancellationPolicyPage() {
  const router = useRouter()
  const { status, isLoading, saveProviderSettings } = useOnboardingStore()

  // Check if onboarding is completed (read-only mode)
  const isReadOnly = status?.isCompleted ?? false

  // Cancellation policy
  const [selectedPolicy, setSelectedPolicy] = useState<CancellationPolicy>('moderate')

  // Track original data and changes
  const [originalData, setOriginalData] = useState<{
    selectedPolicy: CancellationPolicy
  } | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Saving state
  const [isSaving, setIsSaving] = useState(false)

  // Load saved cancellation policy settings
  useEffect(() => {
    const loadSettings = async () => {
      const response = await onboardingService.getProviderSettings()

      if (response.success && response.data) {
        const savedSettings = response.data
        const loadedPolicy = savedSettings.cancellationPolicy as CancellationPolicy
        setSelectedPolicy(loadedPolicy)

        // Store original data for comparison
        setOriginalData({
          selectedPolicy: loadedPolicy,
        })
      } else {
        // No data exists yet - set originalData to represent empty server state
        setOriginalData({
          selectedPolicy: 'moderate',
        })
      }
    }
    void loadSettings()
  }, [])

  // Detect form changes
  useEffect(() => {
    if (!originalData) return

    // If step hasn't been completed yet, we don't have saved values to compare against
    // In this case, hasUnsavedChanges should be false (no changes from saved state)
    if (!status?.stepCompletion.step6) {
      setHasUnsavedChanges(false)
      return
    }

    // Step is completed - check if any field has changed from saved values
    const hasChanges = selectedPolicy !== originalData.selectedPolicy

    setHasUnsavedChanges(hasChanges)
  }, [selectedPolicy, originalData, status?.stepCompletion.step6])

  // Route protection: Check if user can access Step 6
  useEffect(() => {
    if (status && !canAccessStep(6, status)) {
      const nextStep = getNextAccessibleStep(status)
      router.push(nextStep)
    }
  }, [status, router])

  const handleSaveAndContinue = async () => {
    // Save cancellation policy settings
    const settings: SaveProviderSettingsRequest = {
      cancellationPolicy: selectedPolicy,
      cancellationPolicyCustom: null,
    }

    try {
      setIsSaving(true)
      await saveProviderSettings(settings)
      setIsSaving(false)

      // Navigate to Step 7 (Review) on success
      router.push('/onboarding/review')
    } catch (error: any) {
      setIsSaving(false)
      console.error('Failed to save cancellation policy:', error)
    }
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
      breadcrumb="Provider Onboarding / Cancellation Policy"
      footer={
        <OnboardingFooter
          onNext={async () => {
            // If step is already completed and no changes, just navigate
            if (isReadOnly || (status?.stepCompletion.step6 && !hasUnsavedChanges)) {
              router.push('/onboarding/review')
            } else {
              // Step not completed or changes detected - save first
              await handleSaveAndContinue()
            }
          }}
          onBack={() => router.push('/onboarding/deposit-settings')}
          isLoading={isLoading || isSaving}
          isDisabled={false}
          nextButtonText={
            isReadOnly || (status?.stepCompletion.step6 && !hasUnsavedChanges)
              ? 'Next →'
              : 'Save & Continue →'
          }
        />
      }
    >
      <div>
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-3xl font-bold leading-tight text-foreground">
              Cancellation Policy
            </h1>
            <TrustScoreBadge section="step5" maxPoints={10} />
          </div>
          <p className="text-base text-default-500">
            Define your refund policy for the balance amount (excluding deposit)
          </p>
        </div>

        {/* Policy Templates */}
        <div className="mb-8">
          <label className="mb-4 block text-base font-semibold text-foreground">
            Choose a Policy Template
            <span className="ml-1 text-danger">*</span>
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            {POLICY_TEMPLATES.map(policy => (
              <button
                key={policy.value}
                type="button"
                onClick={() => {
                  if (isReadOnly) return
                  setSelectedPolicy(policy.value)
                }}
                disabled={isReadOnly}
                className={`cursor-pointer rounded-xl border p-6 text-left transition-all ${
                  selectedPolicy === policy.value
                    ? 'border-primary bg-primary-50'
                    : 'border-default-200 hover:border-default-500'
                } ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <div className="mb-2 text-lg font-semibold text-foreground">{policy.title}</div>
                <div className="mb-3 text-sm text-default-500">{policy.description}</div>
                <div className="space-y-1">
                  {policy.details.map((detail, idx) => (
                    <div key={idx} className="text-xs text-default-500">
                      • {detail}
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Policy Preview */}
        <div className="mb-8 rounded-xl border border-default-200 bg-default-50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Policy Preview</h3>
          <div className="space-y-2">
            {POLICY_TEMPLATES.find(p => p.value === selectedPolicy)?.details.map((detail, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span className="text-sm text-default-500">{detail}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-warning-50 p-4">
            <p className="text-sm text-default-500">
              <strong>Note:</strong> The deposit is always non-refundable. This policy applies only
              to the balance payment.
            </p>
          </div>
        </div>
      </div>
    </OnboardingPageLayout>
  )
}
