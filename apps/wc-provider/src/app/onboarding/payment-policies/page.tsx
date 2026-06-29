'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addToast, Checkbox, Skeleton, Spinner } from '@heroui/react'
import { DatePicker, Input, SelectField } from '@world-schools/ui-web'
import type { CalendarDate } from '@internationalized/date'
import {
  type CancellationPolicyTier,
  DEFAULT_CUSTOM_POLICY_TIERS,
  type RefundPercentage,
  type SpecialCircumstanceRefundPercentage,
  type SpecialCircumstanceType,
} from '@world-schools/wc-types'
import {
  formatCurrency,
  getCurrencySymbol,
  getRefundAmount,
  resolveTiers,
} from '@world-schools/wc-utils'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { OnboardingFooter } from '../../../components/onboarding/OnboardingFooter'
import { TrustScoreBadge } from '../../../components/onboarding/TrustScoreBadge'
import type {
  CancellationPolicy,
  CancellationPolicySpecialCircumstance,
  SaveProviderSettingsRequest,
} from '../../../types/onboarding'
import { canAccessStep, getNextAccessibleStep } from '../../../utils/onboarding-access'
import { onboardingService } from '../../../services/onboarding.services'
import { useCalculatorConfig } from '../_use-calculator-config'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpecialCircumstanceState {
  enabled: boolean
  refundPercentage: SpecialCircumstanceRefundPercentage
}

interface SpecialCircumstancesMap {
  medical: SpecialCircumstanceState
  force_majeure: SpecialCircumstanceState
  weather: SpecialCircumstanceState
}

interface DepositSnapshot {
  depositRequired: boolean
  depositType?: 'percentage' | 'fixed' | null
  depositPercentage?: number | null
  depositFixedAmount?: number | null
}

interface OriginalData {
  policy: CancellationPolicy
  customTiers: CancellationPolicyTier[]
  specialCircumstances: SpecialCircumstancesMap
  termsAgreed: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLICY_TEMPLATES = [
  {
    value: 'flexible' as CancellationPolicy,
    icon: '🌟',
    title: 'Flexible',
    description: '100% refund until 30 days before, 0% after',
    badge: 'Popular',
  },
  {
    value: 'moderate' as CancellationPolicy,
    icon: '⚖️',
    title: 'Moderate',
    description: '100% until 60 days, 50% until 30 days, 0% after',
    badge: null,
  },
  {
    value: 'custom' as CancellationPolicy,
    icon: '⚙️',
    title: 'Custom',
    description: 'Set your own refund percentages for each time period',
    badge: null,
  },
]

const CUSTOM_TIER_LABELS: Record<number, string> = {
  90: '90+ days before start',
  60: '60–89 days before',
  30: '30–59 days before',
  0: 'Under 30 days',
}

const REFUND_OPTIONS: RefundOption[] = [
  { value: 100, label: '100% refund' },
  { value: 75, label: '75% refund' },
  { value: 50, label: '50% refund' },
  { value: 25, label: '25% refund' },
  { value: 0, label: '0% (no refund)' },
]

type RefundOption = { value: number; label: string }

const SPECIAL_CIRCUMSTANCES_CONFIG = [
  {
    key: 'medical' as SpecialCircumstanceType,
    icon: '🏥',
    title: 'Medical emergency',
    description: 'Refund balance if child cannot attend due to illness or injury',
  },
  {
    key: 'force_majeure' as SpecialCircumstanceType,
    icon: '⚠️',
    title: 'Force majeure events',
    description: 'Refund balance for COVID, natural disasters, or travel bans',
  },
  {
    key: 'weather' as SpecialCircumstanceType,
    icon: '🌧️',
    title: 'Weather cancellation',
    description: 'Refund balance if camp cancels due to severe weather',
  },
]

const SPECIAL_REFUND_OPTIONS: Array<{ value: SpecialCircumstanceRefundPercentage; label: string }> =
  [
    { value: 100, label: '100% of balance' },
    { value: 90, label: '90% of balance' },
    { value: 75, label: '75% of balance' },
    { value: 50, label: '50% of balance' },
  ]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultSpecialCircumstances(): SpecialCircumstancesMap {
  return {
    medical: { enabled: false, refundPercentage: 100 },
    force_majeure: { enabled: false, refundPercentage: 100 },
    weather: { enabled: false, refundPercentage: 100 },
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingStep6CancellationPolicyPage() {
  const calculatorConfig = useCalculatorConfig()
  // Sentinel values used only while `calculatorConfig` is loading; the
  // calculator body and the percentage in the terms label are gated below
  // so these never reach the screen.
  const { currency, appFeePercentage } = calculatorConfig ?? { currency: '', appFeePercentage: 0 }
  const router = useRouter()
  const {
    status,
    isLoading,
    saveProviderSettings,
    calcPrice,
    calcStartDate,
    setCalcPrice,
    setCalcStartDate,
  } = useOnboardingStore()
  const isReadOnly = status?.isCompleted ?? false

  // Policy
  const [selectedPolicy, setSelectedPolicy] = useState<CancellationPolicy>('moderate')
  const [customTiers, setCustomTiers] = useState<CancellationPolicyTier[]>(
    DEFAULT_CUSTOM_POLICY_TIERS.map(t => ({ ...t }))
  )
  const [customTierError, setCustomTierError] = useState('')

  // Special circumstances
  const [specialCircumstances, setSpecialCircumstances] = useState<SpecialCircumstancesMap>(
    defaultSpecialCircumstances()
  )

  // Terms
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [termsError, setTermsError] = useState(false)
  const termsRef = useRef<HTMLDivElement>(null)

  // Saving
  const [isSaving, setIsSaving] = useState(false)

  // Change detection
  const [originalData, setOriginalData] = useState<OriginalData | null>(null)

  // Deposit settings (for sidebar calculator)
  const [depositSnapshot, setDepositSnapshot] = useState<DepositSnapshot | null>(null)

  // ── Load settings on mount ──────────────────────────────────────────────────

  useEffect(() => {
    const loadSettings = async () => {
      const [policyRes, depositRes] = await Promise.all([
        onboardingService.getProviderSettings(),
        onboardingService.getDepositSettings(),
      ])

      // Load deposit for sidebar
      if (depositRes.success && depositRes.data) {
        setDepositSnapshot({
          depositRequired: depositRes.data.depositRequired,
          depositType: depositRes.data.depositType,
          depositPercentage: depositRes.data.depositPercentage,
          depositFixedAmount: depositRes.data.depositFixedAmount,
        })
      }

      // Load policy settings
      if (policyRes.success && policyRes.data) {
        const saved = policyRes.data

        // Defensive: any policy name we don't recognise (typo, future
        // option, etc.) falls back to the safe default. Currently the only
        // valid options are flexible / moderate / custom.
        const displayPolicies: CancellationPolicy[] = ['flexible', 'moderate', 'custom']
        const loadedPolicy = displayPolicies.includes(
          saved.cancellationPolicy as CancellationPolicy
        )
          ? (saved.cancellationPolicy as CancellationPolicy)
          : 'moderate'

        setSelectedPolicy(loadedPolicy)

        // Restore custom tiers if present
        const loadedTiers =
          loadedPolicy === 'custom' &&
          saved.cancellationPolicyCustom &&
          Array.isArray((saved.cancellationPolicyCustom as Record<string, unknown>).tiers)
            ? ((saved.cancellationPolicyCustom as Record<string, unknown>)
                .tiers as CancellationPolicyTier[])
            : DEFAULT_CUSTOM_POLICY_TIERS.map(t => ({ ...t }))
        setCustomTiers(loadedTiers)

        // Restore special circumstances
        const loadedCircumstances = defaultSpecialCircumstances()
        if (saved.cancellationPolicySpecialCircumstances) {
          saved.cancellationPolicySpecialCircumstances.forEach(
            (c: CancellationPolicySpecialCircumstance) => {
              if (c.type in loadedCircumstances) {
                loadedCircumstances[c.type as keyof SpecialCircumstancesMap] = {
                  enabled: true,
                  refundPercentage: c.refundPercentage,
                }
              }
            }
          )
        }
        setSpecialCircumstances(loadedCircumstances)

        // Terms agreed if previously saved
        const agreed = Boolean(saved.cancellationPolicyAgreedAt)
        setTermsAgreed(agreed)

        setOriginalData({
          policy: loadedPolicy,
          customTiers: loadedTiers.map(t => ({ ...t })),
          specialCircumstances: JSON.parse(JSON.stringify(loadedCircumstances)),
          termsAgreed: agreed,
        })
      } else {
        setOriginalData({
          policy: 'moderate',
          customTiers: DEFAULT_CUSTOM_POLICY_TIERS.map(t => ({ ...t })),
          specialCircumstances: defaultSpecialCircumstances(),
          termsAgreed: false,
        })
      }
    }

    void loadSettings()
  }, [])

  // ── Route protection ──────────────────────────────────────────────────────

  useEffect(() => {
    if (status && !canAccessStep(6, status)) {
      const nextStep = getNextAccessibleStep(status)
      router.push(nextStep)
    }
  }, [status, router])

  // ── Change detection ──────────────────────────────────────────────────────

  const hasAnyFieldChanged = (): boolean => {
    if (!status?.stepCompletion.step6) return false
    if (!originalData) return false

    if (selectedPolicy !== originalData.policy) return true
    if (JSON.stringify(customTiers) !== JSON.stringify(originalData.customTiers)) return true
    if (JSON.stringify(specialCircumstances) !== JSON.stringify(originalData.specialCircumstances))
      return true

    return false
  }

  // ── Calculator helpers ────────────────────────────────────────────────────

  const calculateDeposit = (price: number): number => {
    if (!depositSnapshot?.depositRequired) return 0
    if (depositSnapshot.depositType === 'percentage') {
      return Math.round((price * (depositSnapshot.depositPercentage ?? 0)) / 100)
    }
    return Number(depositSnapshot.depositFixedAmount ?? 0)
  }

  const calculateServiceFee = (price: number): number =>
    Math.round((price * appFeePercentage) / 100)
  const calculateEarnings = (price: number): number => price - calculateServiceFee(price)
  // Net amount released to the provider for the deposit (gross deposit minus
  // the platform's percentage fee on it). Used in the Payment Schedule so the
  // "At booking" + "Balance released" rows sum to "Your earnings".
  const calculateDepositNet = (price: number): number =>
    Math.round(calculateDeposit(price) * (1 - appFeePercentage / 100))

  // ── Custom tier helpers ───────────────────────────────────────────────────

  const updateCustomTier = (index: number, refundPercentage: number) => {
    setCustomTiers(prev =>
      prev.map((t, i) =>
        i === index
          ? {
              ...t,
              refundPercentage: refundPercentage as RefundPercentage,
            }
          : t
      )
    )
    setCustomTierError('')
  }

  // ── Special circumstances helpers ────────────────────────────────────────

  const toggleSpecialCircumstance = (type: SpecialCircumstanceType) => {
    if (isReadOnly) return
    setSpecialCircumstances(prev => ({
      ...prev,
      [type]: { ...prev[type], enabled: !prev[type].enabled },
    }))
  }

  const updateSpecialRefund = (
    type: SpecialCircumstanceType,
    refundPercentage: SpecialCircumstanceRefundPercentage
  ) => {
    setSpecialCircumstances(prev => ({
      ...prev,
      [type]: { ...prev[type], refundPercentage },
    }))
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSaveAndContinue = async () => {
    // Terms agreement required
    if (!termsAgreed) {
      setTermsError(true)
      if (termsRef.current) {
        termsRef.current.classList.add('animate-shake')
        setTimeout(() => termsRef.current?.classList.remove('animate-shake'), 600)
        termsRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }
    setTermsError(false)

    // Validate custom policy tiers (non-increasing order)
    if (selectedPolicy === 'custom') {
      for (let i = 0; i < customTiers.length - 1; i++) {
        if (customTiers[i].refundPercentage < customTiers[i + 1].refundPercentage) {
          setCustomTierError(
            'Refund percentages must be non-increasing (each tier must be ≤ the one above)'
          )
          return
        }
      }
    }
    setCustomTierError('')

    const enabledCircumstances: CancellationPolicySpecialCircumstance[] = (
      Object.entries(specialCircumstances) as [SpecialCircumstanceType, SpecialCircumstanceState][]
    )
      .filter(([, v]) => v.enabled)
      .map(([type, v]) => ({ type, refundPercentage: v.refundPercentage }))

    const settings: SaveProviderSettingsRequest = {
      cancellationPolicy: selectedPolicy,
      cancellationPolicyCustom: selectedPolicy === 'custom' ? { tiers: customTiers } : null,
      cancellationPolicySpecialCircumstances:
        enabledCircumstances.length > 0 ? enabledCircumstances : null,
      termsAgreed: true,
    }

    // `saveProviderSettings` never throws (apiClient converts
    // errors to `ApiResult`, store wrapper returns a boolean). The previous
    // try/catch was dead code, and `router.push` ran unconditionally — silently
    // navigating past failed saves. Now we branch on the boolean and surface
    // the server error to the parent via a toast before staying put.
    setIsSaving(true)
    const ok = await saveProviderSettings(settings)
    setIsSaving(false)
    if (!ok) {
      const error = useOnboardingStore.getState().error
      addToast({
        title: 'Could not save cancellation policy',
        description: error ?? 'Please try again in a moment.',
        color: 'danger',
      })
      return
    }
    router.push('/onboarding/review')
  }

  // ── Spinner while status loads ────────────────────────────────────────────

  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  // ── Right Sidebar ─────────────────────────────────────────────────────────

  const activeTiers = resolveTiers(selectedPolicy, { tiers: customTiers })
  const deposit = calculateDeposit(calcPrice)
  const remaining = calcPrice - deposit
  const depositNet = calculateDepositNet(calcPrice)
  const serviceFee = calculateServiceFee(calcPrice)
  const earnings = calculateEarnings(calcPrice)
  // Split fee/net per payment moment so the breakdown table sums back to the
  // top-line totals exactly (avoids rounding drift between deposit + remaining).
  const remainingNet = earnings - depositNet
  const depositFee = deposit - depositNet
  const remainingFee = remaining - remainingNet
  const hasSpecialCircumstances = Object.values(specialCircumstances).some(c => c.enabled)

  const policySidebar = (
    <div className="px-12">
      {/* Calculator Header */}
      <div className="-mx-12 mb-6 bg-default-50 px-12 py-6">
        <h3 className="mb-4 text-lg font-bold text-foreground">Policy Impact Calculator</h3>
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

      <div className="flex flex-col gap-5 pb-10">
        {/* Earnings Breakdown */}
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

          {depositSnapshot?.depositRequired ? (
            /* Three-column breakdown: row label | Deposit | Remaining */
            <div className="mt-2 border-t border-default-200 pt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-default-400">
                    <th className="pb-2 text-left font-semibold"></th>
                    <th className="pb-2 text-right font-semibold">
                      Deposit
                      {depositSnapshot.depositType === 'percentage' &&
                        depositSnapshot.depositPercentage != null && (
                          <span className="ml-1 font-normal normal-case text-default-400">
                            ({depositSnapshot.depositPercentage}%)
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

        {/* Payment Schedule */}
        <div className="rounded-xl border-2 border-primary bg-primary-50 p-5">
          <div className="mb-4 text-sm font-bold text-foreground">Payment Schedule</div>
          <div className="space-y-3">
            {depositSnapshot?.depositRequired && (
              <div className="grid grid-cols-[100px_90px_1fr] items-center gap-3 border-b border-primary-200 pb-3">
                <span className="text-sm font-semibold text-foreground">At booking</span>
                <span className="text-right text-sm font-bold text-success">
                  {calculatorConfig === null ? (
                    <Skeleton className="inline-block h-3 w-16 rounded align-middle" />
                  ) : (
                    formatCurrency(depositNet, currency)
                  )}
                </span>
                <span className="text-sm leading-snug text-default-500">After 48h</span>
              </div>
            )}
            <div className="grid grid-cols-[100px_90px_1fr] items-center gap-3">
              <span className="text-sm font-semibold text-foreground">
                {calcStartDate
                  ? new Date(
                      calcStartDate.year,
                      calcStartDate.month - 1,
                      calcStartDate.day
                    ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : ''}
              </span>
              <span className="text-right text-sm font-bold text-success">
                {calculatorConfig === null ? (
                  <Skeleton className="inline-block h-3 w-16 rounded align-middle" />
                ) : (
                  formatCurrency(
                    earnings - (depositSnapshot?.depositRequired ? depositNet : 0),
                    currency
                  )
                )}
              </span>
              <span className="text-sm leading-snug text-default-500">Balance released</span>
            </div>
          </div>
          <div className="mt-2 border-t border-primary-200 pt-3 text-center text-xs text-default-500">
            {calculatorConfig === null ? (
              <Skeleton className="inline-block h-3 w-6 rounded align-middle" />
            ) : (
              <>{appFeePercentage}%</>
            )}{' '}
            service fee applied to each payment
          </div>
        </div>

        {/* Cancellation Refund Preview */}
        <div className="rounded-xl bg-default-50 p-5">
          <div className="mb-3 text-sm font-bold text-foreground">Cancellation Refund Preview</div>
          <p className="mb-4 text-xs text-default-400">
            Deposit is always non-refundable. Refunds below apply to the balance only.
          </p>
          <div className="space-y-2">
            {activeTiers.map((tier, idx) => {
              // Only the first (highest) tier is open-ended ("X+ days").
              // Every subsequent tier is bounded above by the previous tier's
              // floor minus one day, so middle tiers don't visually overlap
              // with the tier above them.
              const upperBound = idx === 0 ? null : activeTiers[idx - 1].daysBeforeStart - 1
              const daysLabel =
                upperBound === null
                  ? `${tier.daysBeforeStart}+ days before`
                  : `${tier.daysBeforeStart}–${upperBound} days before`
              const balanceAmount = calcPrice - deposit
              const refundAmount = getRefundAmount(balanceAmount, tier.refundPercentage)

              return (
                <div
                  key={tier.daysBeforeStart}
                  className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-sm"
                >
                  <span className="text-default-500">{daysLabel}</span>
                  <span
                    className={`font-semibold ${tier.refundPercentage === 0 ? 'text-danger' : 'text-success'}`}
                  >
                    {tier.refundPercentage}% →{' '}
                    {calculatorConfig === null ? (
                      <Skeleton className="inline-block h-3 w-12 rounded align-middle" />
                    ) : (
                      formatCurrency(refundAmount, currency)
                    )}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Special circumstances note */}
          {hasSpecialCircumstances && (
            <div className="mt-4 flex gap-2 rounded-lg border border-warning-200 bg-warning-50 p-3">
              <span className="text-base">⚠️</span>
              <p className="text-xs text-warning-600">
                Special circumstances may entitle parents to additional refunds. Funds are held in
                escrow until circumstances are verified.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <OnboardingPageLayout
      breadcrumb="Provider Onboarding / Cancellation Policy"
      footer={
        <OnboardingFooter
          onNext={async () => {
            if (isReadOnly || (status?.stepCompletion.step6 && !hasAnyFieldChanged())) {
              router.push('/onboarding/review')
            } else {
              await handleSaveAndContinue()
            }
          }}
          onBack={() => router.push('/onboarding/deposit-settings')}
          isLoading={isLoading || isSaving}
          isDisabled={false}
          nextButtonText={
            isReadOnly || (status?.stepCompletion.step6 && !hasAnyFieldChanged())
              ? 'Next →'
              : 'Save & Continue →'
          }
        />
      }
      rightSidebar={policySidebar}
    >
      <div>
        {/* Header */}
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

        {/* ── Policy Templates ─────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <label className="text-base font-semibold text-foreground">
              Choose a cancellation policy
              <span className="ml-1 text-danger">*</span>
            </label>
          </div>

          <div className="flex flex-col gap-3">
            {POLICY_TEMPLATES.map(template => (
              <label
                key={template.value}
                htmlFor={`policy_${template.value}`}
                className={`relative flex cursor-pointer items-start gap-4 rounded-xl border-2 p-5 transition-all has-checked:border-primary has-checked:bg-primary-50 ${
                  isReadOnly
                    ? 'cursor-not-allowed opacity-60'
                    : 'border-default-200 hover:border-default-400'
                }`}
              >
                <input
                  type="radio"
                  id={`policy_${template.value}`}
                  name="cancellationPolicy"
                  value={template.value}
                  checked={selectedPolicy === template.value}
                  onChange={() => {
                    if (isReadOnly) return
                    setSelectedPolicy(template.value)
                    setCustomTierError('')
                  }}
                  disabled={isReadOnly}
                  className="peer absolute opacity-0"
                />
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-default-100 text-xl transition-colors peer-checked:bg-primary peer-checked:text-secondary">
                  {template.icon}
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{template.title}</span>
                    {template.badge && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-secondary">
                        {template.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-sm leading-relaxed text-default-500">
                    {template.description}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {/* Custom Policy Builder */}
          {selectedPolicy === 'custom' && (
            <div className="mt-4 rounded-xl bg-default-50 p-6">
              <p className="mb-4 text-sm font-semibold text-foreground">
                Customize refund percentages (of balance)
              </p>
              <div className="flex flex-col gap-2">
                {customTiers.map((tier, idx) => (
                  <div
                    key={tier.daysBeforeStart}
                    className="flex items-center justify-between rounded-lg bg-background px-4 py-3"
                  >
                    <span className="text-sm text-foreground">
                      {CUSTOM_TIER_LABELS[tier.daysBeforeStart] ?? `${tier.daysBeforeStart}+ days`}
                    </span>
                    <SelectField
                      value={String(tier.refundPercentage)}
                      onChange={v => updateCustomTier(idx, parseInt(v))}
                      isDisabled={isReadOnly}
                      options={REFUND_OPTIONS.map(opt => ({
                        value: String(opt.value),
                        label: opt.label,
                      }))}
                      fullWidth={false}
                    />
                  </div>
                ))}
              </div>
              {customTierError && <p className="mt-3 text-sm text-danger">{customTierError}</p>}
            </div>
          )}
        </div>

        {/* ── Special Circumstances ─────────────────────────────────────── */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <label className="text-base font-semibold text-foreground">Special circumstances</label>
            <span className="text-sm text-default-400">(optional)</span>
            <div className="group relative">
              <div className="flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-default-300 bg-default-100 text-xs text-default-500">
                i
              </div>
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg bg-foreground px-3 py-2 text-xs text-background opacity-0 transition-opacity group-hover:opacity-100">
                These apply to the balance only — the deposit is never refundable.
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {SPECIAL_CIRCUMSTANCES_CONFIG.map(({ key, icon, title, description }) => {
              const state = specialCircumstances[key]
              return (
                <div
                  key={key}
                  onClick={() => toggleSpecialCircumstance(key)}
                  className={`cursor-pointer rounded-xl border-2 p-5 transition-all ${
                    state.enabled
                      ? 'border-primary bg-primary-50'
                      : 'border-default-200 hover:border-default-400'
                  } ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{icon}</span>
                      <div>
                        <div className="mb-0.5 text-sm font-semibold text-foreground">{title}</div>
                        <div className="text-sm text-default-500">{description}</div>
                      </div>
                    </div>
                    {/* Refund select — only shown when enabled */}
                    {state.enabled && (
                      <div onClick={e => e.stopPropagation()}>
                        <SelectField
                          aria-label={title}
                          value={String(state.refundPercentage)}
                          onChange={v =>
                            updateSpecialRefund(
                              key,
                              parseInt(v) as SpecialCircumstanceRefundPercentage
                            )
                          }
                          isDisabled={isReadOnly}
                          options={SPECIAL_REFUND_OPTIONS.map(opt => ({
                            value: String(opt.value),
                            label: opt.label,
                          }))}
                          fullWidth={false}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Policy Note ──────────────────────────────────────────────── */}
        <div className="mb-8 rounded-xl border border-warning-200 bg-warning-50 p-4">
          <p className="text-sm text-default-600">
            <strong>Note:</strong> The deposit is always non-refundable and released to you 48 hours
            after booking. This policy applies only to the balance payment.
          </p>
        </div>

        {/* ── Terms Agreement ───────────────────────────────────────────── */}
        <div className="mb-2">
          <div
            ref={termsRef}
            className={`flex items-start gap-1 rounded-xl border-2 bg-default-50 p-4 transition-colors ${
              termsError ? 'border-danger bg-danger-50' : 'border-transparent'
            }`}
          >
            <Checkbox
              isSelected={termsAgreed}
              onValueChange={checked => {
                setTermsAgreed(checked)
                if (checked) setTermsError(false)
              }}
              isDisabled={isReadOnly}
            />
            <span className="text-sm leading-relaxed text-foreground">
              <strong>I agree to these payment terms and cancellation policies.</strong> I
              understand these will be shown to parents when they book and that World-Camps charges
              a{' '}
              {calculatorConfig === null ? (
                <Skeleton className="inline-block h-3 w-8 rounded align-middle" />
              ) : (
                <>{appFeePercentage}%</>
              )}{' '}
              service fee on successful bookings.
            </span>
          </div>
          {termsError && (
            <p className="mt-2 text-sm text-danger">
              ⚠️ Please agree to the payment terms to continue
            </p>
          )}
        </div>
      </div>
    </OnboardingPageLayout>
  )
}
