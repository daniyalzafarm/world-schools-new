'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Autocomplete, AutocompleteItem, Button, Spinner } from '@heroui/react'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { TrustScoreBadge } from '../../../components/onboarding/TrustScoreBadge'
import type {
  CancellationPolicy,
  DepositType,
  SaveProviderSettingsRequest,
} from '../../../types/onboarding'
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

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'NZD', label: 'NZD - New Zealand Dollar' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'INR', label: 'INR - Indian Rupee' },
]

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
  { value: 'Europe/Zurich', label: 'Zurich (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEDT/AEST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZDT/NZST)' },
]

export default function OnboardingStep5Page() {
  const router = useRouter()
  const { status, isLoading, saveProviderSettings } = useOnboardingStore()

  // Check if onboarding is completed (read-only mode)
  const isReadOnly = status?.isCompleted ?? false

  // Currency and Timezone
  const [currency, setCurrency] = useState('CHF')
  const [timezone, setTimezone] = useState('Europe/Zurich')

  // Deposit settings
  const [depositType, setDepositType] = useState<DepositType>('percentage')
  const [depositPercentage, setDepositPercentage] = useState('25')
  const [depositFixedAmount, setDepositFixedAmount] = useState('')

  // Cancellation policy
  const [selectedPolicy, setSelectedPolicy] = useState<CancellationPolicy>('moderate')

  // Inline validation state
  const [depositPercentageError, setDepositPercentageError] = useState('')
  const [depositFixedAmountError, setDepositFixedAmountError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Sample price for calculator
  const samplePrice = 1000

  // Load saved provider settings
  useEffect(() => {
    const loadSettings = async () => {
      const response = await onboardingService.getProviderSettings()

      // Check if response is successful and has data
      if (response.success && response.data) {
        const savedSettings = response.data

        // Load currency and timezone
        setCurrency(savedSettings.currency || 'USD')
        setTimezone(savedSettings.timezone || 'America/New_York')

        // Convert backend depositType to frontend format
        // Backend: 'percentage' | 'fixed'
        // Frontend: 'percentage' | 'fixed_amount'
        const frontendDepositType =
          savedSettings.depositType === 'fixed' ? 'fixed_amount' : 'percentage'

        setDepositType(frontendDepositType as DepositType)

        if (
          savedSettings.depositPercentage !== null &&
          savedSettings.depositPercentage !== undefined
        ) {
          setDepositPercentage(savedSettings.depositPercentage.toString())
        }

        if (
          savedSettings.depositFixedAmount !== null &&
          savedSettings.depositFixedAmount !== undefined
        ) {
          setDepositFixedAmount(savedSettings.depositFixedAmount.toString())
        }

        setSelectedPolicy(savedSettings.cancellationPolicy)
      }
    }
    void loadSettings()
  }, [])

  // Route protection: Check if user can access Step 5
  useEffect(() => {
    if (status && !canAccessStep(5, status)) {
      const nextStep = getNextAccessibleStep(status)
      router.push(nextStep)
    }
  }, [status, router])

  const calculateDeposit = () => {
    if (depositType === 'percentage') {
      const percentage = parseFloat(depositPercentage) || 0
      return (samplePrice * percentage) / 100
    } else {
      return parseFloat(depositFixedAmount) || 0
    }
  }

  const calculateBalance = () => {
    return samplePrice - calculateDeposit()
  }

  const handleSaveAndContinue = async () => {
    // Clear previous errors
    setDepositPercentageError('')
    setDepositFixedAmountError('')

    // Validate deposit settings before saving
    let hasErrors = false

    if (depositType === 'percentage') {
      const percentage = parseFloat(depositPercentage)
      if (isNaN(percentage) || percentage < 1 || percentage > 100) {
        setDepositPercentageError('Deposit percentage must be between 1 and 100')
        hasErrors = true
      }
    } else {
      const amount = parseFloat(depositFixedAmount)
      if (isNaN(amount) || amount < 1) {
        setDepositFixedAmountError('Deposit amount must be at least $1')
        hasErrors = true
      }
    }

    if (hasErrors) {
      return
    }

    // Convert frontend depositType to backend format
    // Frontend: 'percentage' | 'fixed_amount'
    // Backend: 'percentage' | 'fixed'
    const backendDepositType = depositType === 'fixed_amount' ? 'fixed' : 'percentage'

    // Save current step settings
    const settings: SaveProviderSettingsRequest = {
      currency,
      timezone,
      depositRequired: true,
      depositType: backendDepositType,
      depositPercentage: depositType === 'percentage' ? parseFloat(depositPercentage) : null,
      depositFixedAmount: depositType === 'fixed_amount' ? parseFloat(depositFixedAmount) : null,
      cancellationPolicy: selectedPolicy,
      cancellationPolicyCustom: null,
    }

    try {
      setIsSaving(true)
      await saveProviderSettings(settings)

      // Navigate to Step 6 on success
      router.push('/onboarding/step-6')
    } catch (error: any) {
      setIsSaving(false)
      console.error('Failed to save provider settings:', error)

      // Handle save errors - show generic error for API failures
      // Specific field validation is handled above before the API call
      if (depositType === 'percentage') {
        setDepositPercentageError('Failed to save settings. Please try again.')
      } else {
        setDepositFixedAmountError('Failed to save settings. Please try again.')
      }
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
      breadcrumb="Provider Onboarding / Payment & Cancellation Settings"
      footer={
        <div className="flex items-center justify-between">
          <Button variant="light" onPress={() => router.push('/onboarding/step-4')}>
            ← Back
          </Button>
          <Button
            color="primary"
            size="lg"
            onPress={isReadOnly ? () => router.push('/onboarding/step-6') : handleSaveAndContinue}
            isDisabled={!isReadOnly && (!!depositPercentageError || !!depositFixedAmountError)}
            isLoading={isLoading || isSaving}
          >
            {isReadOnly ? 'Next →' : 'Save & Continue →'}
          </Button>
        </div>
      }
    >
      <div>
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-3xl font-bold leading-tight text-foreground">
              Payment & Cancellation Settings
            </h1>
            <TrustScoreBadge section="step5" maxPoints={10} />
          </div>
          <p className="text-base text-default-500">
            Configure deposit requirements and cancellation policy for your camp programs
          </p>
        </div>

        {/* Currency and Timezone Section */}
        <div className="mb-8 space-y-6">
          <h2 className="text-xl font-semibold text-foreground">Regional Settings</h2>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Currency */}
            <Autocomplete
              label="Currency"
              labelPlacement="outside"
              placeholder="Select currency"
              selectedKey={currency}
              onSelectionChange={key => setCurrency(key as string)}
              isDisabled={isReadOnly}
              isRequired
              classNames={{
                base: 'w-full',
                listboxWrapper: 'max-h-[320px]',
              }}
              inputProps={{
                classNames: {
                  inputWrapper:
                    'rounded-lg bg-white border border-gray-200 hover:border-gray-300 focus-within:border-primary! focus-within:bg-white! dark:border-gray-600',
                },
              }}
            >
              {CURRENCIES.map(curr => (
                <AutocompleteItem key={curr.value}>{curr.label}</AutocompleteItem>
              ))}
            </Autocomplete>

            {/* Timezone */}
            <Autocomplete
              label="Timezone"
              labelPlacement="outside"
              placeholder="Select timezone"
              selectedKey={timezone}
              onSelectionChange={key => setTimezone(key as string)}
              isDisabled={isReadOnly}
              isRequired
              classNames={{
                base: 'w-full',
                listboxWrapper: 'max-h-[320px]',
              }}
              inputProps={{
                classNames: {
                  inputWrapper:
                    'rounded-lg bg-white border border-gray-200 hover:border-gray-300 focus-within:border-primary! focus-within:bg-white! dark:border-gray-600',
                },
              }}
            >
              {TIMEZONES.map(tz => (
                <AutocompleteItem key={tz.value}>{tz.label}</AutocompleteItem>
              ))}
            </Autocomplete>
          </div>
        </div>

        {/* Divider */}
        <div className="my-8 border-t border-default-200"></div>

        {/* Deposit Type Selection */}
        <div className="mb-8">
          <label className="mb-4 block text-base font-semibold text-foreground">
            Deposit Requirement
            <span className="ml-1 text-danger">*</span>
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                if (isReadOnly) return
                setDepositType('percentage')
                setDepositFixedAmountError('')
              }}
              disabled={isReadOnly}
              className={`cursor-pointer rounded-xl border p-6 text-left transition-all ${
                depositType === 'percentage'
                  ? 'border-primary bg-primary-50'
                  : 'border-default-200 hover:border-default-500'
              } ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <div className="mb-2 text-lg font-semibold text-foreground">Percentage of Total</div>
              <div className="text-sm text-default-500">
                Charge a percentage of the total camp price
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isReadOnly) return
                setDepositType('fixed_amount')
                setDepositPercentageError('')
              }}
              disabled={isReadOnly}
              className={`cursor-pointer rounded-xl border p-6 text-left transition-all ${
                depositType === 'fixed_amount'
                  ? 'border-primary bg-primary-50'
                  : 'border-default-200 hover:border-default-500'
              } ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <div className="mb-2 text-lg font-semibold text-foreground">Fixed Amount</div>
              <div className="text-sm text-default-500">
                Charge a fixed dollar amount regardless of price
              </div>
            </button>
          </div>
        </div>

        {/* Deposit Amount Input */}
        <div className="mb-8">
          <label className="mb-2 block text-sm font-semibold text-foreground">
            {depositType === 'percentage' ? 'Deposit Percentage' : 'Deposit Amount'}
            <span className="ml-1 text-danger">*</span>
          </label>
          {depositType === 'percentage' ? (
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={depositPercentage}
                  onChange={e => {
                    setDepositPercentage(e.target.value)
                    setDepositPercentageError('')
                  }}
                  placeholder="25"
                  min="1"
                  max="100"
                  disabled={isReadOnly}
                  className={`w-32 rounded-lg border bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500 ${
                    depositPercentageError ? 'border-danger' : 'border-default-200'
                  }`}
                />
                <span className="text-default-500">%</span>
              </div>
              {depositPercentageError && (
                <p className="mt-1 text-sm text-danger">{depositPercentageError}</p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <span className="text-default-500">$</span>
                <input
                  type="number"
                  value={depositFixedAmount}
                  onChange={e => {
                    setDepositFixedAmount(e.target.value)
                    setDepositFixedAmountError('')
                  }}
                  placeholder="100"
                  min="1"
                  disabled={isReadOnly}
                  className={`w-32 rounded-lg border bg-white px-4 py-3 text-base transition-colors hover:border-default-500 focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:bg-default-100 disabled:text-default-500 ${
                    depositFixedAmountError ? 'border-danger' : 'border-default-200'
                  }`}
                />
              </div>
              {depositFixedAmountError && (
                <p className="mt-1 text-sm text-danger">{depositFixedAmountError}</p>
              )}
            </div>
          )}
        </div>

        {/* Payment Schedule Calculator */}
        <div className="mb-8 rounded-xl border border-default-200 bg-default-50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Payment Schedule Preview</h3>
          <p className="mb-4 text-sm text-default-500">Example for a ${samplePrice} camp program</p>

          <div className="space-y-4">
            {/* Payment 1: Deposit */}
            <div className="rounded-lg bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-foreground">Payment 1: At Booking</span>
                <span className="text-lg font-bold text-primary">
                  ${calculateDeposit().toFixed(2)}
                </span>
              </div>
              <div className="text-sm text-default-500">
                Deposit (non-refundable) • You receive this 48 hours after booking
              </div>
            </div>

            {/* Payment 2: Balance */}
            <div className="rounded-lg bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-foreground">Payment 2: Before Camp</span>
                <span className="text-lg font-bold text-foreground">
                  ${calculateBalance().toFixed(2)}
                </span>
              </div>
              <div className="text-sm text-default-500">
                Balance payment • You receive this 7 days before camp starts
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-primary-50 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Total You Receive</span>
              <span className="text-xl font-bold text-foreground">${samplePrice.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-12 border-t border-default-200"></div>

        {/* Cancellation Policy Section */}
        <div className="mb-8">
          <h2 className="mb-2 text-2xl font-bold leading-tight text-foreground">
            Cancellation Policy
          </h2>
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
