'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addToast, Skeleton, Spinner } from '@heroui/react'
import { DatePicker, Input } from '@world-schools/ui-web'
import type { CalendarDate } from '@internationalized/date'
import { formatCurrency, getCurrencySymbol } from '@world-schools/wc-utils'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { OnboardingFooter } from '../../../components/onboarding/OnboardingFooter'
import type { DepositType, SaveDepositSettingsRequest } from '../../../types/onboarding'
import { canAccessStep, getNextAccessibleStep } from '../../../utils/onboarding-access'
import { onboardingService } from '../../../services/onboarding.services'
import { useCalculatorConfig } from '../_use-calculator-config'

export default function OnboardingStep5DepositSettingsPage() {
  const router = useRouter()
  const { status, saveDepositSettings, calcPrice, calcStartDate, setCalcPrice, setCalcStartDate } =
    useOnboardingStore()
  const calculatorConfig = useCalculatorConfig()
  // Sentinel values used only while `calculatorConfig` is loading; the body
  // of the calculator is gated below so these never reach the screen.
  const { currency, appFeePercentage } = calculatorConfig ?? { currency: '', appFeePercentage: 0 }

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

  // Refs for auto-focus
  const percentageInputRef = useRef<HTMLInputElement>(null)
  const fixedAmountInputRef = useRef<HTMLInputElement>(null)
  const isInitialLoadRef = useRef(true)

  // Load saved deposit settings — only after the step has actually been saved.
  // Before first save, the backend returns defaults (depositRequired=false)
  // that would clobber the form's "Percentage 25%" default and flip the
  // selection to "No deposit" on first visit.
  const isStep5Completed = status?.stepCompletion.step5 ?? false
  useEffect(() => {
    if (!isStep5Completed) return

    const loadSettings = async () => {
      const response = await onboardingService.getDepositSettings()

      if (response.success && response.data) {
        const savedSettings = response.data

        // Backend and form share the same discriminator; default to
        // 'percentage' when unset.
        const frontendDepositType = savedSettings.depositType === 'fixed' ? 'fixed' : 'percentage'

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
  }, [isStep5Completed])

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
    } else if (depositType === 'fixed' && fixedAmountInputRef.current) {
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

  // M9 audit fix: compute every breakdown value at FULL precision. Rounding
  // to whole units inside the helper (`Math.round` per line item) lets the
  // table sub-rows drift from the headline total when a currency uses
  // fractional minor units (e.g. €499.99 + €1500.01 = €2000, not €500 +
  // €1500). Formatting at the render boundary via `formatCurrency` (which
  // wraps `Intl.NumberFormat`) respects the currency's natural precision
  // (2 decimals for EUR/USD, 0 for JPY, 3 for KWD) and the breakdown sums
  // back to the total exactly.
  const calculateDeposit = (price: number = calcPrice) => {
    if (!depositRequired) return 0

    if (depositType === 'percentage') {
      const percentage = parseFloat(depositPercentage) || 0
      return (price * percentage) / 100
    }
    return parseFloat(depositFixedAmount) || 0
  }

  const calculateServiceFee = (price: number = calcPrice) => {
    return (price * appFeePercentage) / 100
  }

  const calculateEarnings = (price: number = calcPrice) => {
    return price - calculateServiceFee(price)
  }

  // Net amount released to the provider for the deposit (gross deposit minus
  // the platform's percentage fee on it). Used in the Payment Schedule so the
  // "At booking" + "Balance released" rows sum to "Your earnings" exactly.
  const calculateDepositNet = (price: number = calcPrice) => {
    return calculateDeposit(price) * (1 - appFeePercentage / 100)
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
          // H5 audit fix: render the minimum in the provider's configured
          // currency rather than a hardcoded "$1" — EUR/GBP/JPY providers
          // would otherwise see a USD message that contradicts the rest of
          // the UI. `formatCurrency` respects zero-decimal currencies (JPY,
          // KRW, etc.) automatically.
          setDepositFixedAmountError(
            `Deposit amount must be at least ${formatCurrency(1, currency)}`
          )
          hasErrors = true
        }
      }
    }

    if (hasErrors) {
      return
    }

    // Save deposit settings (form and backend share the same discriminator).
    const settings: SaveDepositSettingsRequest = {
      depositRequired,
      depositType: depositRequired ? depositType : null,
      depositPercentage:
        depositRequired && depositType === 'percentage' ? parseFloat(depositPercentage) : null,
      depositFixedAmount:
        depositRequired && depositType === 'fixed' ? parseFloat(depositFixedAmount) : null,
    }

    // C3 audit fix: `saveDepositSettings` returns a boolean (no longer
    // throws), with the human-readable error left on `state.error`. Branch
    // on the boolean and surface the server error via toast rather than
    // navigating silently past failed saves.
    setIsSaving(true)
    const ok = await saveDepositSettings(settings)
    setIsSaving(false)
    if (!ok) {
      const error = useOnboardingStore.getState().error
      addToast({
        title: 'Could not save deposit settings',
        description: error ?? 'Please try again in a moment.',
        color: 'danger',
      })
      return
    }
    // Backend automatically advances to Step 6 on success; the store has
    // already refetched onboarding status.
    router.push('/onboarding/payment-policies')
  }

  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  // Calculator values — pre-computed so the breakdown table cells stay in sync
  // with the Payment Schedule below (depositFee + remainingFee = total fee,
  // and depositNet + remainingNet = your earnings, regardless of rounding).
  const deposit = calculateDeposit(calcPrice)
  const remaining = calcPrice - deposit
  const depositNet = calculateDepositNet(calcPrice)
  const earnings = calculateEarnings(calcPrice)
  const serviceFee = calculateServiceFee(calcPrice)
  const remainingNet = earnings - depositNet
  const depositFee = deposit - depositNet
  const remainingFee = remaining - remainingNet

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
              startContent={
                <span className="text-sm text-default-500">{getCurrencySymbol(currency)}</span>
              }
            />
          </div>
          <div className="flex-1">
            <DatePicker
              label="Camp Start Date"
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
          {/* Total Amount */}
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-default-500">Total Amount</span>
            <span className="font-semibold text-foreground">
              {calculatorConfig === null ? (
                <Skeleton className="inline-block h-3 w-16 rounded align-middle" />
              ) : (
                formatCurrency(calcPrice, currency)
              )}
            </span>
          </div>

          {depositRequired ? (
            /* Three-column breakdown: row label | Deposit | Remaining */
            <div className="mt-2 border-t border-default-200 pt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-default-400">
                    <th className="pb-2 text-left font-semibold"></th>
                    <th className="pb-2 text-right font-semibold">
                      Deposit
                      {depositType === 'percentage' && depositPercentage && (
                        <span className="ml-1 font-normal normal-case text-default-400">
                          ({depositPercentage}%)
                        </span>
                      )}
                    </th>
                    <th className="pb-2 text-right font-semibold">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1.5 text-default-500">Amount</td>
                    <td className="py-1.5 text-right font-semibold text-foreground">
                      {calculatorConfig === null ? (
                        <Skeleton className="inline-block h-3 w-16 rounded align-middle" />
                      ) : (
                        formatCurrency(deposit, currency)
                      )}
                    </td>
                    <td className="py-1.5 text-right font-semibold text-foreground">
                      {calculatorConfig === null ? (
                        <Skeleton className="inline-block h-3 w-16 rounded align-middle" />
                      ) : (
                        formatCurrency(remaining, currency)
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-default-500">
                      Service fee{' '}
                      {calculatorConfig === null ? (
                        <Skeleton className="inline-block h-3 w-6 rounded align-middle" />
                      ) : (
                        <span className="text-default-400">({appFeePercentage}%)</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right font-semibold text-danger">
                      {calculatorConfig === null ? (
                        <Skeleton className="inline-block h-3 w-16 rounded align-middle" />
                      ) : (
                        <>-{formatCurrency(depositFee, currency)}</>
                      )}
                    </td>
                    <td className="py-1.5 text-right font-semibold text-danger">
                      {calculatorConfig === null ? (
                        <Skeleton className="inline-block h-3 w-16 rounded align-middle" />
                      ) : (
                        <>-{formatCurrency(remainingFee, currency)}</>
                      )}
                    </td>
                  </tr>
                  <tr className="border-t border-default-200">
                    <td className="pt-2 text-sm font-semibold text-foreground">You receive</td>
                    <td className="pt-2 text-right text-sm font-bold text-success">
                      {calculatorConfig === null ? (
                        <Skeleton className="inline-block h-3 w-16 rounded align-middle" />
                      ) : (
                        formatCurrency(depositNet, currency)
                      )}
                    </td>
                    <td className="pt-2 text-right text-sm font-bold text-success">
                      {calculatorConfig === null ? (
                        <Skeleton className="inline-block h-3 w-16 rounded align-middle" />
                      ) : (
                        formatCurrency(remainingNet, currency)
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            /* No deposit — single service-fee row */
            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-default-500">
                Service fee (
                {calculatorConfig === null ? (
                  <Skeleton className="inline-block h-3 w-6 rounded align-middle" />
                ) : (
                  <>{appFeePercentage}%</>
                )}
                )
              </span>
              <span className="font-semibold text-danger">
                {calculatorConfig === null ? (
                  <Skeleton className="inline-block h-3 w-16 rounded align-middle" />
                ) : (
                  <>-{formatCurrency(serviceFee, currency)}</>
                )}
              </span>
            </div>
          )}

          {/* Your Earnings - Total */}
          <div className="mt-3 flex items-center justify-between border-t border-default-200 pt-3">
            <span className="text-sm font-bold text-foreground">Your earnings</span>
            <span className="text-xl font-bold text-success">
              {calculatorConfig === null ? (
                <Skeleton className="inline-block h-5 w-24 rounded align-middle" />
              ) : (
                formatCurrency(earnings, currency)
              )}
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
                <span className="text-right text-sm font-bold text-success">
                  {calculatorConfig === null ? (
                    <Skeleton className="inline-block h-3 w-16 rounded align-middle" />
                  ) : (
                    formatCurrency(calculateDepositNet(calcPrice), currency)
                  )}
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
              <span className="text-right text-sm font-bold text-success">
                {calculatorConfig === null ? (
                  <Skeleton className="inline-block h-3 w-16 rounded align-middle" />
                ) : (
                  formatCurrency(
                    calculateEarnings(calcPrice) -
                      (depositRequired ? calculateDepositNet(calcPrice) : 0),
                    currency
                  )
                )}
              </span>
              <span className="text-sm leading-snug text-default-500">Balance released</span>
            </div>
          </div>

          {/* Service Fee Note */}
          <div className="mt-2 border-t border-primary-200 pt-3 text-center text-xs text-default-500">
            {calculatorConfig === null ? (
              <Skeleton className="inline-block h-3 w-6 rounded align-middle" />
            ) : (
              <>{appFeePercentage}%</>
            )}{' '}
            service fee applied to each payment
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
          <h1 className="mb-2 text-3xl font-bold leading-tight text-foreground">
            Deposit Settings
          </h1>
          <p className="text-sm text-default-500">
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
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-default-100 text-xl transition-colors peer-checked:bg-primary peer-checked:text-secondary">
                %
              </div>
              <div className="flex-1">
                <div className="mb-1 text-sm font-semibold text-foreground">Percentage</div>
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
                        className="w-24 border-none px-3.5 py-3 text-center text-lg font-semibold outline-none"
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
                value="fixed"
                checked={depositRequired && depositType === 'fixed'}
                onChange={() => {
                  setDepositRequired(true)
                  setDepositType('fixed')
                }}
                disabled={isReadOnly}
                className="peer absolute opacity-0"
              />
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-default-100 text-xl transition-colors peer-checked:bg-primary">
                💵
              </div>
              <div className="flex-1">
                <div className="mb-1 text-sm font-semibold text-foreground">Fixed amount</div>
                <div className="text-sm leading-relaxed text-default-500">
                  Same amount regardless of price
                </div>

                {/* Inline Input for Fixed Amount */}
                {depositRequired && depositType === 'fixed' && (
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
                        className="w-24 border-none px-3.5 py-3 text-center text-lg font-semibold outline-none"
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
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-default-100 text-xl transition-colors peer-checked:bg-primary">
                💳
              </div>
              <div className="flex-1">
                <div className="mb-1 text-sm font-semibold text-foreground">No deposit</div>
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
