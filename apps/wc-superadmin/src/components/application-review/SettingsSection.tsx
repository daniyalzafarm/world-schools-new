'use client'

import { EMOJI } from '@world-schools/wc-frontend-utils'
import type { ProviderSettings } from '../../types/application-review'

interface SettingsSectionProps {
  settings: ProviderSettings
}

export function SettingsSection({ settings }: SettingsSectionProps) {
  const getCancellationPolicyLabel = (policy: string) => {
    switch (policy) {
      case 'flexible':
        return 'Flexible (7 days)'
      case 'moderate':
        return 'Moderate (14 days)'
      case 'strict':
        return 'Strict (30 days)'
      case 'super_strict':
        return 'Super Strict (60 days)'
      case 'custom':
        return 'Custom'
      default:
        return policy
    }
  }

  return (
    <div className="rounded-lg border border-default-200 p-6">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        {EMOJI.CREDIT_CARD} Payment & Policy Settings
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-default-600">Currency</div>
          <div className="text-foreground">{settings.currency}</div>
        </div>
        <div>
          <div className="text-sm text-default-600">Timezone</div>
          <div className="text-foreground">{settings.timezone}</div>
        </div>
        <div>
          <div className="text-sm text-default-600">Deposit Required</div>
          <div className="text-foreground">{settings.depositRequired ? 'Yes' : 'No'}</div>
        </div>
        {settings.depositRequired && (
          <div>
            <div className="text-sm text-default-600">Deposit Amount</div>
            <div className="text-foreground">
              {settings.depositType === 'percentage'
                ? `${settings.depositPercentage}%`
                : `$${settings.depositFixedAmount}`}
            </div>
          </div>
        )}
        <div className="col-span-2">
          <div className="text-sm text-default-600">Cancellation Policy</div>
          <div className="text-foreground">
            {getCancellationPolicyLabel(settings.cancellationPolicy)}
          </div>
          {settings.cancellationPolicy === 'custom' && settings.cancellationPolicyCustom && (
            <div className="mt-2 rounded-lg bg-default-50 p-3 text-sm text-default-600">
              {settings.cancellationPolicyCustom}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
