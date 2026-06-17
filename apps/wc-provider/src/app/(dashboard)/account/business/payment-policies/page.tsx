'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { BackButton } from '@world-schools/ui-web'
import {
  type CancellationPolicyTier,
  FLEXIBLE_POLICY_TIERS,
  MODERATE_POLICY_TIERS,
  type SpecialCircumstanceType,
  STRICT_POLICY_TIERS,
} from '@world-schools/wc-types'
import { onboardingService } from '@/services/onboarding.services'
import { useAuth } from '@/hooks/use-auth'
import type { CancellationPolicy, CancellationPolicySpecialCircumstance } from '@/types/onboarding'

interface PaymentPoliciesData {
  cancellationPolicy: string
  cancellationPolicyCustom?: Record<string, unknown> | null
  cancellationPolicySpecialCircumstances?: CancellationPolicySpecialCircumstance[] | null
  cancellationPolicyAgreedAt?: string | null
}

const POLICY_TEMPLATES: Record<
  CancellationPolicy,
  { icon: string; title: string; description: string; badge?: string | null }
> = {
  flexible: {
    icon: '🌟',
    title: 'Flexible',
    description: '100% refund until 30 days before, 0% after',
    badge: 'Popular',
  },
  moderate: {
    icon: '⚖️',
    title: 'Moderate',
    description: '100% until 60 days, 50% until 30 days, 0% after',
  },
  strict: {
    icon: '🔒',
    title: 'Strict',
    description: '100% until 90 days, 50% until 60 days, 0% after',
  },
  custom: {
    icon: '⚙️',
    title: 'Custom',
    description: 'Custom refund percentages for each time period',
  },
}

const CUSTOM_TIER_LABELS: Record<number, string> = {
  90: '90+ days before start',
  60: '60–89 days before',
  30: '30–59 days before',
  0: 'Under 30 days',
}

const SPECIAL_CIRCUMSTANCES_CONFIG: Array<{
  key: SpecialCircumstanceType
  icon: string
  title: string
  description: string
}> = [
  {
    key: 'medical',
    icon: '🏥',
    title: 'Medical emergency',
    description: 'Refund balance if child cannot attend due to illness or injury',
  },
  {
    key: 'force_majeure',
    icon: '⚠️',
    title: 'Force majeure events',
    description: 'Refund balance for COVID, natural disasters, or travel bans',
  },
  {
    key: 'weather',
    icon: '🌧️',
    title: 'Weather cancellation',
    description: 'Refund balance if camp cancels due to severe weather',
  },
]

function resolveTiers(
  policy: CancellationPolicy,
  custom: PaymentPoliciesData['cancellationPolicyCustom']
): readonly CancellationPolicyTier[] {
  if (policy === 'flexible') return FLEXIBLE_POLICY_TIERS
  if (policy === 'moderate') return MODERATE_POLICY_TIERS
  if (policy === 'strict') return STRICT_POLICY_TIERS
  if (policy === 'custom' && custom) {
    try {
      const parsed =
        typeof custom === 'string'
          ? (JSON.parse(custom) as { tiers?: CancellationPolicyTier[] })
          : (custom as unknown as { tiers?: CancellationPolicyTier[] })
      if (Array.isArray(parsed?.tiers)) return parsed.tiers
    } catch {
      return []
    }
  }
  return []
}

function formatAgreementDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export default function PaymentPoliciesViewPage() {
  const router = useRouter()
  const { isProviderAdmin } = useAuth()
  const [settings, setSettings] = useState<PaymentPoliciesData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isProviderAdmin) {
      router.replace('/account')
      return
    }
    void loadSettings()
  }, [isProviderAdmin])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const result = await onboardingService.getProviderSettings()
      if (result.success) {
        setSettings(result.data ?? null)
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-default-500">Loading payment policies...</p>
      </div>
    )
  }

  const policy = settings?.cancellationPolicy as CancellationPolicy | undefined
  const tiers = policy ? resolveTiers(policy, settings?.cancellationPolicyCustom ?? null) : []
  const specialCircumstances: CancellationPolicySpecialCircumstance[] =
    settings?.cancellationPolicySpecialCircumstances ?? []
  const agreedAt = settings?.cancellationPolicyAgreedAt
  const template = policy ? POLICY_TEMPLATES[policy] : null

  return (
    <div>
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-4">
          <BackButton href="/account" />
          <h1 className="text-3xl font-bold leading-tight text-foreground">Payment Policies</h1>
        </div>
        <p className="text-sm text-default-500">
          Review the cancellation policy parents see when they book.
        </p>
      </div>

      {settings && policy && template ? (
        <>
          {/* Cancellation Policy */}
          <div className="mb-8">
            <p className="mb-2 text-base font-semibold text-foreground">Cancellation policy</p>

            <div className="flex items-start gap-4 rounded-xl border-2 border-primary bg-primary-50 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-xl">
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
            </div>

            {tiers.length > 0 && (
              <div className="mt-4 rounded-xl bg-default-50 p-6">
                <p className="mb-4 text-sm font-semibold text-foreground">
                  Refund schedule (of balance)
                </p>
                <div className="flex flex-col gap-2">
                  {tiers.map(tier => (
                    <div
                      key={tier.daysBeforeStart}
                      className="flex items-center justify-between rounded-lg bg-background px-4 py-3"
                    >
                      <span className="text-sm text-foreground">
                        {CUSTOM_TIER_LABELS[tier.daysBeforeStart] ??
                          `${tier.daysBeforeStart}+ days before`}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {tier.refundPercentage}% refund
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Special Circumstances */}
          <div className="mb-8">
            <div className="mb-2 flex items-center gap-2">
              <p className="text-base font-semibold text-foreground">Special circumstances</p>
              <span className="text-sm text-default-400">(optional)</span>
            </div>

            <div className="flex flex-col gap-3">
              {SPECIAL_CIRCUMSTANCES_CONFIG.map(({ key, icon, title, description }) => {
                const match = specialCircumstances.find(c => c.type === key)
                const enabled = Boolean(match)
                return (
                  <div
                    key={key}
                    className={`rounded-xl border-2 p-5 transition-colors ${
                      enabled ? 'border-primary bg-primary-50' : 'border-default-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="text-xl shrink-0">{icon}</span>
                        <div>
                          <div className="mb-0.5 text-sm font-semibold text-foreground">
                            {title}
                          </div>
                          <div className="text-sm text-default-500">{description}</div>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {enabled && match ? (
                          <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-secondary">
                            {match.refundPercentage}% of balance
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-default-400">Not enabled</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Note */}
          <div className="mb-8 rounded-xl border border-warning-200 bg-warning-50 p-4">
            <p className="text-sm leading-relaxed text-default-600">
              <strong className="text-foreground">Note:</strong> The deposit is always
              non-refundable and released to you 48 hours after booking. This policy applies only to
              the balance payment.
            </p>
          </div>

          {/* Agreement */}
          {agreedAt && (
            <div className="flex items-start gap-3 rounded-xl bg-default-50 p-4">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-white">
                <Check size={14} strokeWidth={3} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Payment terms agreed on {formatAgreementDate(agreedAt)}
                </p>
                <p className="text-xs text-default-500">
                  These terms are shown to parents when they book.
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-default-200 p-8 text-center">
          <p className="text-sm text-default-500">
            Payment policies haven&apos;t been configured yet. Complete onboarding to set them up.
          </p>
        </div>
      )}
    </div>
  )
}
