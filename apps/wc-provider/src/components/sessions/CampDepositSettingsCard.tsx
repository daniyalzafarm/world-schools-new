'use client'

import { useEffect, useState } from 'react'
import { Button, Card, CardBody, Spinner } from '@heroui/react'
import { formatCurrency } from '@world-schools/wc-utils'
import { type CampDepositSettings, getCampDepositSettings } from '@/services/camps.services'
import { useCampsStore } from '@/stores/camps-store'
import { CampDepositSettingsModal } from './CampDepositSettingsModal'

interface CampDepositSettingsCardProps {
  campId: string
}

function summarize(settings: CampDepositSettings, currency: string): string {
  if (!settings.depositRequired) return 'No deposit — full payment at booking'
  if (settings.depositType === 'fixed' && settings.depositFixedAmount != null) {
    return `${formatCurrency(settings.depositFixedAmount, currency)} fixed deposit at booking`
  }
  if (settings.depositType === 'percentage' && settings.depositPercentage != null) {
    return `${settings.depositPercentage}% deposit at booking`
  }
  return '—'
}

/**
 * Per-camp deposit settings — summary card on the sessions page. Shows the
 * current saved settings and opens a modal for edits. The provider-level row
 * remains the default for new camps; editing onboarding does not propagate to
 * existing camps.
 */
export function CampDepositSettingsCard({ campId }: CampDepositSettingsCardProps) {
  const [savedSettings, setSavedSettings] = useState<CampDepositSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const currency = useCampsStore(state => state.currentCamp?.currency) ?? 'USD'

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      const response = await getCampDepositSettings(campId)
      if (cancelled) return
      if (response.success && response.data) {
        setSavedSettings(response.data)
      }
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [campId])

  if (isLoading) {
    return (
      <Card shadow="none" className="border border-default-200 mb-4">
        <CardBody className="p-4 flex items-center justify-center min-h-[72px]">
          <Spinner size="sm" />
        </CardBody>
      </Card>
    )
  }

  return (
    <>
      <Card shadow="none" className="border border-default-200 mb-4">
        <CardBody className="p-4 flex flex-row items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground">Deposit Settings</h3>
            <p className="text-sm text-default-700 mt-0.5 truncate">
              {savedSettings
                ? summarize(savedSettings, currency)
                : 'Unable to load deposit settings'}
            </p>
          </div>
          <Button
            size="sm"
            variant="bordered"
            onPress={() => setIsModalOpen(true)}
            isDisabled={!savedSettings}
          >
            Change
          </Button>
        </CardBody>
      </Card>

      {savedSettings && (
        <CampDepositSettingsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          campId={campId}
          initialSettings={savedSettings}
          currency={currency}
          onSaved={s => setSavedSettings(s)}
        />
      )}
    </>
  )
}
