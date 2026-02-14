'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'
import { DatePicker, Input } from '@world-schools/ui-web'
import { type CalendarDate, parseDate } from '@internationalized/date'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { OnboardingFooter } from '../../../components/onboarding/OnboardingFooter'
import type { DepositType, SaveDepositSettingsRequest } from '../../../types/onboarding'
import { canAccessStep, getNextAccessibleStep } from '../../../utils/onboarding-access'
import { onboardingService } from '../../../services/onboarding.services'

// Helper function to convert string dates to CalendarDate
const stringToCalendarDate = (dateString: string): CalendarDate | null => {
  if (!dateString) return null
  try {
    return parseDate(dateString)
  } catch {
    return null
  }
}

export default function OnboardingStep5DepositSettingsPage() {
  const router = useRouter()
  const { status, saveDepositSettings } = useOnboardingStore()

  // Check if onboarding is completed (read-only mode)
  const isReadOnly = status?.isCompleted ?? false

  // Deposit settings
  const [depositRequired, setDepositRequired] = useState(true)
  const [depositType, setDepositType] = useState<DepositType>('percentage')
  const [depositPercentage, setDepositPercentage] = useState('25')
  const [depositFixedAmount, setDepositFixedAmount] = useState('')

  // Track originally loaded values to detect changes (consolidated into single state object)
  const [savedValues, setSavedValues] = useState<{
    depositRequired: boolean | null
    depositType: DepositType | null
    depositPercentage: string | null
    depositFixedAmount: string | null
  }>({
    depositRequired: null,
    depositType: null,
    depositPercentage: null,
    depositFixedAmount: null,
  })

  // Inline validation state
  const [depositPercentageError, setDepositPercentageError] = useState('')
  const [depositFixedAmountError, setDepositFixedAmountError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Calculator state
  const [calcPrice, setCalcPrice] = useState(2000)
  const [calcStartDate, setCalcStartDate] = useState<CalendarDate | null>(() => {
    const date = new Date()
    date.setMonth(date.getMonth() + 8)
    const dateString = date.toISOString().split('T')[0]
    return stringToCalendarDate(dateString)
  })

  // Refs for auto-focus
  const percentageInputRef = useRef<HTMLInputElement>(null)
  const fixedAmountInputRef = useRef<HTMLInputElement>(null)
  const isInitialLoadRef = useRef(true)

  // Load saved deposit settings
  useEffect(() => {
    const loadSettings = async () => {
      const response = await onboardingService.getDepositSettings()

      if (response.success && response.data) {
        const savedSettings = response.data

        // Convert backend depositType to frontend format
        const frontendDepositType =
          savedSettings.depositType === 'fixed' ? 'fixed_amount' : 'percentage'

        const loadedDepositPercentage =
          savedSettings.depositPercentage !== null && savedSettings.depositPercentage !== undefined
            ? savedSettings.depositPercentage.toString()
            : '25'

        const loadedDepositFixedAmount =
          savedSettings.depositFixedAmount !== null &&
          savedSettings.depositFixedAmount !== undefined
            ? savedSettings.depositFixedAmount.toString()
            : ''

        // Set current form values
        setDepositRequired(savedSettings.depositRequired)
        setDepositType(frontendDepositType as DepositType)
        setDepositPercentage(loadedDepositPercentage)
        setDepositFixedAmount(loadedDepositFixedAmount)

        // Save original values for change detection (consolidated into single state update)
        setSavedValues({
          depositRequired: savedSettings.depositRequired,
          depositType: frontendDepositType as DepositType,
          depositPercentage: loadedDepositPercentage,
          depositFixedAmount: loadedDepositFixedAmount,
        })
      }
    }

    void loadSettings()
  }, [])

  // Auto-focus input when deposit type changes (but not on initial load)
  useEffect(() => {
    // Skip auto-focus on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      return
    }

    // Only auto-focus if deposit is required and not in read-only mode
    if (!depositRequired || isReadOnly) {
      return
    }

    // Auto-focus the appropriate input based on deposit type
    if (depositType === 'percentage' && percentageInputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        percentageInputRef.current?.focus()
      }, 100)
    } else if (depositType === 'fixed_amount' && fixedAmountInputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        fixedAmountInputRef.current?.focus()
      }, 100)
    }
  }, [depositType, depositRequired, isReadOnly])

  // Route protection: Check if user can access Step 5
  useEffect(() => {
    if (status && !canAccessStep(5, status)) {
      const nextStep = getNextAccessibleStep(status)
      router.push(nextStep)
    }
  }, [status, router])

  // Helper function to check if ANY fields have changed from saved values
  // This is used to determine if the "Save & Continue" button should be shown
  const hasAnyFieldChanged = (): boolean => {
    // If step hasn't been completed yet, we don't have saved values to compare against
    // In this case, return false (no changes from saved state) since nothing has been saved yet
    if (!status?.stepCompletion.step5) {
      return false
    }

    // Step is completed - check if any field has changed from saved values
    if (depositRequired !== savedValues.depositRequired) return true
    if (depositType !== savedValues.depositType) return true
    if (depositPercentage !== savedValues.depositPercentage) return true
    if (depositFixedAmount !== savedValues.depositFixedAmount) return true

    return false
  }

  const calculateDeposit = (price: number = calcPrice) => {
    if (!depositRequired) return 0

    if (depositType === 'percentage') {
      const percentage = parseFloat(depositPercentage) || 0
      return Math.round((price * percentage) / 100)
    } else {
      return parseFloat(depositFixedAmount) || 0
    }
  }

  const calculateServiceFee = (price: number = calcPrice) => {
    return Math.round(price * 0.1)
  }

  const calculateEarnings = (price: number = calcPrice) => {
    return price - calculateServiceFee(price)
  }

  const handleSaveAndContinue = async () => {
    // Clear previous errors
    setDepositPercentageError('')
    setDepositFixedAmountError('')

    // Validate deposit settings before saving
    let hasErrors = false

    if (depositRequired) {
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
    }

    if (hasErrors) {
      return
    }

    // Convert frontend depositType to backend format
    const backendDepositType = depositType === 'fixed_amount' ? 'fixed' : 'percentage'

    // Save deposit settings
    const settings: SaveDepositSettingsRequest = {
      depositRequired,
      depositType: depositRequired ? backendDepositType : null,
      depositPercentage:
        depositRequired && depositType === 'percentage' ? parseFloat(depositPercentage) : null,
      depositFixedAmount:
        depositRequired && depositType === 'fixed_amount' ? parseFloat(depositFixedAmount) : null,
    }

    try {
      setIsSaving(true)
      // Use store method which automatically fetches updated status
      await saveDepositSettings(settings)
      setIsSaving(false)

      // Navigate to Step 6 (Cancellation Policy) on success
      // Note: Backend automatically advances to Step 6, and store fetches updated status
      router.push('/onboarding/payment-policies')
    } catch (error: any) {
      setIsSaving(false)
      console.error('Failed to save deposit settings:', error)

      // Handle save errors
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

  // Payment Calculator Component for Right Sidebar
  const paymentCalculator = (
    <div className="px-12">
      {/* Calculator Header with Gray Background */}
      <div className="-mx-12 mb-6 bg-default-50 px-12 py-6">
        <h3 className="mb-4 text-lg font-bold text-foreground">Earnings Calculator</h3>

        {/* Interactive Input Fields */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              label="Program Price"
              type="number"
              value={calcPrice.toString()}
              onChange={e => setCalcPrice(parseInt(e.target.value) || 0)}
              min={0}
              step={100}
              classNames={{
                label: 'text-xs font-semibold uppercase tracking-wide',
              }}
            />
          </div>
          <div className="flex-1">
            <DatePicker
              label="Start Date"
              labelPlacement="outside"
              value={calcStartDate}
              onChange={date => setCalcStartDate(date as CalendarDate | null)}
              classNames={{
                label: 'mb-0.5 text-xs font-semibold uppercase tracking-wide',
              }}
            />
          </div>
        </div>
      </div>

      {/* Calculator Body */}
      <div className="flex flex-col gap-5 pb-10">
        {/* Breakdown Section */}
        <div className="rounded-xl bg-default-50 p-4">
          {/* Deposit Info Row - Conditional */}
          {depositRequired && (
            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-default-500">Deposit (non-refundable)</span>
              <span className="font-semibold text-foreground">
                {depositType === 'percentage'
                  ? `${depositPercentage}% ($${calculateDeposit(calcPrice).toLocaleString()})`
                  : `$${calculateDeposit(calcPrice).toLocaleString()}`}
              </span>
            </div>
          )}

          {/* Program Price */}
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-default-500">Program price</span>
            <span className="font-semibold text-foreground">${calcPrice.toLocaleString()}</span>
          </div>

          {/* Service Fee */}
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-default-500">Service fee (10%)</span>
            <span className="font-semibold text-danger">
              -${calculateServiceFee(calcPrice).toLocaleString()}
            </span>
          </div>

          {/* Your Earnings - Total */}
          <div className="mt-1 flex items-center justify-between border-t border-default-200 pt-3">
            <span className="text-sm font-bold text-foreground">Your earnings</span>
            <span className="text-xl font-bold text-success">
              ${calculateEarnings(calcPrice).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Payment Schedule - HERO SECTION */}
        <div className="rounded-xl border-2 border-primary bg-primary-50 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
            Payment Schedule
          </div>

          {/* Schedule Items */}
          <div className="space-y-3">
            {/* Deposit Payment (if required) */}
            {depositRequired && (
              <div className="grid grid-cols-[100px_90px_1fr] items-center gap-3 border-b border-primary-200 pb-3">
                <span className="text-sm font-semibold text-foreground">At booking</span>
                <span className="text-right text-[15px] font-bold text-success">
                  ${calculateDeposit(calcPrice).toLocaleString()}
                </span>
                <span className="text-sm leading-snug text-default-500">After 48h</span>
              </div>
            )}

            {/* Balance Payment */}
            <div className="grid grid-cols-[100px_90px_1fr] items-center gap-3">
              <span className="text-sm font-semibold text-foreground">
                {calcStartDate
                  ? new Date(
                      calcStartDate.year,
                      calcStartDate.month - 1,
                      calcStartDate.day
                    ).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : ''}
              </span>
              <span className="text-right text-[15px] font-bold text-success">
                $
                {(
                  calculateEarnings(calcPrice) -
                  (depositRequired ? Math.round(calculateDeposit(calcPrice) * 0.9) : 0)
                ).toLocaleString()}
              </span>
              <span className="text-sm leading-snug text-default-500">Balance released</span>
            </div>
          </div>

          {/* Service Fee Note */}
          <div className="mt-2 border-t border-primary-200 pt-3 text-center text-[11px] text-default-500">
            10% service fee applied to each payment
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <OnboardingPageLayout
      breadcrumb="Provider Onboarding / Deposit Settings"
      footer={
        <OnboardingFooter
          onNext={async () => {
            // If step is already completed and no changes, just navigate
            if (status?.stepCompletion.step5 && !hasAnyFieldChanged()) {
              router.push('/onboarding/payment-policies')
            } else {
              // Step not completed or changes detected - save first
              await handleSaveAndContinue()
            }
          }}
          onBack={() => router.push('/onboarding/verification')}
          nextButtonText={(() => {
            if (isReadOnly) return 'Next →'
            if (isSaving) return 'Saving...'

            // Check if step is completed and no changes
            if (status?.stepCompletion.step5 && !hasAnyFieldChanged()) {
              return 'Next →'
            } else {
              return 'Save & Continue →'
            }
          })()}
          isDisabled={isSaving || isReadOnly}
          isLoading={isSaving}
        />
      }
      rightSidebar={paymentCalculator}
    >
      <div>
        {/* Section Header */}
        <div className="mb-6">
          <h1 className="mb-2 text-[28px] font-bold leading-tight text-foreground">
            Deposit Settings
          </h1>
          <p className="text-[15px] text-default-500">
            Set up how parents will pay upfront for your camp programs
          </p>
        </div>

        {/* Non-refundable Deposit Section */}
        <div className="mb-8">
          <p className="mb-2 text-base font-semibold text-foreground">
            Non-refundable deposit
            <span className="ml-1 text-danger">*</span>
          </p>

          {/* Radio Card Group */}
          <div className="flex flex-col gap-3">
            {/* Percentage Option */}
            <label
              htmlFor="deposit_percentage"
              className="relative flex cursor-pointer items-start gap-4 rounded-xl border-2 border-default-200 p-5 transition-all hover:border-default-400 has-checked:border-primary has-checked:bg-primary-50"
            >
              <input
                type="radio"
                id="deposit_percentage"
                name="depositType"
                value="percentage"
                checked={depositRequired && depositType === 'percentage'}
                onChange={() => {
                  setDepositRequired(true)
                  setDepositType('percentage')
                }}
                disabled={isReadOnly}
                className="peer absolute opacity-0"
              />
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-default-100 text-xl transition-colors peer-checked:bg-primary peer-checked:text-secondary">
                %
              </div>
              <div className="flex-1">
                <div className="mb-1 text-[15px] font-semibold text-foreground">Percentage</div>
                <div className="text-sm leading-relaxed text-default-500">Most common option</div>

                {/* Inline Input for Percentage */}
                {depositRequired && depositType === 'percentage' && (
                  <div
                    className="mt-3 flex items-center gap-3 border-t border-dashed border-default-300 pt-3"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="inline-flex overflow-hidden rounded-lg border-2 border-default-200 bg-background transition-colors focus-within:border-primary">
                      <input
                        ref={percentageInputRef}
                        type="number"
                        value={depositPercentage}
                        onChange={e => setDepositPercentage(e.target.value)}
                        min="1"
                        max="100"
                        disabled={isReadOnly}
                        className="w-[100px] border-none px-3.5 py-3 text-center text-lg font-semibold outline-none"
                      />
                      <span className="bg-default-100 px-3.5 py-3 text-base font-semibold text-default-600">
                        %
                      </span>
                    </div>
                    <span className="text-sm text-default-500">of total program price</span>
                  </div>
                )}
                {depositPercentageError && (
                  <p className="mt-2 text-sm text-danger">{depositPercentageError}</p>
                )}
              </div>
            </label>

            {/* Fixed Amount Option */}
            <label
              htmlFor="deposit_fixed"
              className="relative flex cursor-pointer items-start gap-4 rounded-xl border-2 border-default-200 p-5 transition-all hover:border-default-400 has-checked:border-primary has-checked:bg-primary-50"
            >
              <input
                type="radio"
                id="deposit_fixed"
                name="depositType"
                value="fixed_amount"
                checked={depositRequired && depositType === 'fixed_amount'}
                onChange={() => {
                  setDepositRequired(true)
                  setDepositType('fixed_amount')
                }}
                disabled={isReadOnly}
                className="peer absolute opacity-0"
              />
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-default-100 text-xl transition-colors peer-checked:bg-primary">
                💵
              </div>
              <div className="flex-1">
                <div className="mb-1 text-[15px] font-semibold text-foreground">Fixed amount</div>
                <div className="text-sm leading-relaxed text-default-500">
                  Same amount regardless of price
                </div>

                {/* Inline Input for Fixed Amount */}
                {depositRequired && depositType === 'fixed_amount' && (
                  <div
                    className="mt-3 flex items-center gap-3 border-t border-dashed border-default-300 pt-3"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="inline-flex overflow-hidden rounded-lg border-2 border-default-200 bg-background transition-colors focus-within:border-primary">
                      <span className="bg-default-100 px-3.5 py-3 text-base font-semibold text-default-600">
                        $
                      </span>
                      <input
                        ref={fixedAmountInputRef}
                        type="number"
                        value={depositFixedAmount}
                        onChange={e => setDepositFixedAmount(e.target.value)}
                        min="1"
                        disabled={isReadOnly}
                        className="w-[100px] border-none px-3.5 py-3 text-center text-lg font-semibold outline-none"
                      />
                    </div>
                    <span className="text-sm text-default-500">fixed deposit amount</span>
                  </div>
                )}
                {depositFixedAmountError && (
                  <p className="mt-2 text-sm text-danger">{depositFixedAmountError}</p>
                )}
              </div>
            </label>

            {/* No Deposit Option */}
            <label
              htmlFor="deposit_none"
              className="relative flex cursor-pointer items-start gap-4 rounded-xl border-2 border-default-200 p-5 transition-all hover:border-default-400 has-checked:border-primary has-checked:bg-primary-50"
            >
              <input
                type="radio"
                id="deposit_none"
                name="depositType"
                value="none"
                checked={!depositRequired}
                onChange={() => setDepositRequired(false)}
                disabled={isReadOnly}
                className="peer absolute opacity-0"
              />
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-default-100 text-xl transition-colors peer-checked:bg-primary">
                💳
              </div>
              <div className="flex-1">
                <div className="mb-1 text-[15px] font-semibold text-foreground">No deposit</div>
                <div className="text-sm leading-relaxed text-default-500">
                  Payment follows cancellation policy only
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </OnboardingPageLayout>
  )
}
