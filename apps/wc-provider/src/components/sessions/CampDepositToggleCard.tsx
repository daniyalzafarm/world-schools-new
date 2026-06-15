'use client'

import { Card, CardBody, Spinner, Switch } from '@heroui/react'
import { useState } from 'react'
import { useCampsStore } from '@/stores/camps-store'

interface CampDepositToggleCardProps {
  campId: string
  depositEnabled: boolean
}

/**
 * Per-listing deposit toggle (Payments revamp, Spec v2.3). Autosaves to the
 * camp's basic-info on change. When OFF, families pay no deposit for this camp —
 * the whole price becomes the balance and is captured automatically before the
 * camp starts, overriding the provider-level deposit setting.
 */
export function CampDepositToggleCard({ campId, depositEnabled }: CampDepositToggleCardProps) {
  const updateBasicInfo = useCampsStore(state => state.updateBasicInfo)
  const [enabled, setEnabled] = useState(depositEnabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = async (next: boolean) => {
    setEnabled(next) // optimistic
    setSaving(true)
    setError(null)
    const result = await updateBasicInfo(campId, { depositEnabled: next })
    setSaving(false)
    if (!result) {
      setEnabled(!next) // rollback on failure (the store surfaces a toast)
      setError('Could not save. Please try again.')
    }
  }

  return (
    <Card shadow="none" className="border border-default-200">
      <CardBody className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-foreground">Deposit for this listing</h3>
            <p className="mt-1 text-sm text-default-500">
              When off, families pay no deposit for this camp — the full balance is charged
              automatically before the camp starts. This overrides your provider-level deposit
              setting for this listing only.
            </p>
            {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {saving ? <Spinner size="sm" /> : null}
            <Switch
              isSelected={enabled}
              onValueChange={handleToggle}
              isDisabled={saving}
              aria-label="Deposit enabled for this listing"
            />
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
