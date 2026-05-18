'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Skeleton } from '@heroui/react'
import { BackButton } from '@world-schools/ui-web'
import { formatCurrency } from '@world-schools/wc-utils'
import { onboardingService } from '@/services/onboarding.services'
import { useAuth } from '@/hooks/use-auth'
import { useCalculatorConfig } from '@/app/onboarding/_use-calculator-config'

interface DepositSettings {
  depositRequired: boolean
  depositType?: 'percentage' | 'fixed' | null
  depositPercentage?: number | null
  depositFixedAmount?: number | null
}

export default function DepositSettingsViewPage() {
  const router = useRouter()
  const { isProviderAdmin } = useAuth()
  const calculatorConfig = useCalculatorConfig()
  const [settings, setSettings] = useState<DepositSettings | null>(null)
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
      const result = await onboardingService.getDepositSettings()
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
        <p className="text-sm text-default-500">Loading deposit settings...</p>
      </div>
    )
  }

  const depositRequired = settings?.depositRequired ?? false
  const depositType = settings?.depositType
  const depositPercentage = settings?.depositPercentage
  const depositFixedAmount = settings?.depositFixedAmount

  const renderActiveCard = () => {
    if (!depositRequired) {
      return (
        <div className="flex items-start gap-4 rounded-xl border-2 border-primary bg-primary-50 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-xl">
            💳
          </div>
          <div className="flex-1">
            <div className="mb-1 text-sm font-semibold text-foreground">No deposit</div>
            <div className="text-sm leading-relaxed text-default-500">
              Payment follows cancellation policy only
            </div>
          </div>
        </div>
      )
    }

    if (depositType === 'fixed') {
      return (
        <div className="flex items-start gap-4 rounded-xl border-2 border-primary bg-primary-50 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-xl">
            💵
          </div>
          <div className="flex-1">
            <div className="mb-1 text-sm font-semibold text-foreground">Fixed amount</div>
            <div className="text-sm leading-relaxed text-default-500">
              Same amount regardless of price
            </div>
            <div className="mt-3 border-t border-dashed border-default-300 pt-3">
              <span className="text-2xl font-bold text-foreground">
                {calculatorConfig === null ? (
                  <Skeleton className="inline-block h-7 w-24 rounded align-middle" />
                ) : (
                  formatCurrency(depositFixedAmount ?? 0, calculatorConfig.currency)
                )}
              </span>
              <span className="ml-2 text-sm text-default-500">fixed deposit amount</span>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-start gap-4 rounded-xl border-2 border-primary bg-primary-50 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-xl">
          %
        </div>
        <div className="flex-1">
          <div className="mb-1 text-sm font-semibold text-foreground">Percentage</div>
          <div className="text-sm leading-relaxed text-default-500">Most common option</div>
          <div className="mt-3 border-t border-dashed border-default-300 pt-3">
            <span className="text-2xl font-bold text-foreground">{depositPercentage ?? 0}%</span>
            <span className="ml-2 text-sm text-default-500">of total program price</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-4">
          <BackButton href="/account" />
          <h1 className="text-3xl font-bold leading-tight text-foreground">Deposit Settings</h1>
        </div>
        <p className="text-sm text-default-500">
          Review the deposit configuration parents see when they book your camp.
        </p>
      </div>

      {settings ? (
        <>
          <div className="mb-8">
            <p className="mb-2 text-base font-semibold text-foreground">Non-refundable deposit</p>
            {renderActiveCard()}
          </div>

          {depositRequired && (
            <div className="mb-8 rounded-xl bg-default-50 p-4">
              <p className="text-sm leading-relaxed text-default-600">
                <strong className="text-foreground">When parents pay:</strong> the deposit is
                charged at booking and released to you 48 hours after the booking is confirmed.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-warning-200 bg-warning-50 p-4">
            <p className="text-sm leading-relaxed text-default-600">
              <strong className="text-foreground">Note:</strong> Deposits are always non-refundable,
              regardless of cancellation policy.
            </p>
          </div>
        </>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-default-200 p-8 text-center">
          <p className="text-sm text-default-500">
            Deposit settings haven&apos;t been configured yet. Complete onboarding to set them up.
          </p>
        </div>
      )}
    </div>
  )
}
