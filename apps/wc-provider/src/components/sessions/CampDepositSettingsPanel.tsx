'use client'

import { useEffect, useRef, useState } from 'react'
import { addToast, Button, Spinner } from '@heroui/react'
import { X } from 'lucide-react'
import { getCurrencySymbol } from '@world-schools/wc-utils'
import {
  type CampDepositSettings,
  type CampDepositType,
  getCampDepositSettings,
  updateCampDepositSettings,
} from '@/services/camps.services'
import { useCampsStore } from '@/stores/camps-store'

interface CampDepositSettingsPanelProps {
  campId: string
  onClose: () => void
}

type DepositMode = 'none' | 'percentage' | 'fixed'

function modeFromSettings(s: CampDepositSettings): DepositMode {
  if (!s.depositRequired) return 'none'
  return s.depositType === 'fixed' ? 'fixed' : 'percentage'
}

export function CampDepositSettingsPanel({ campId, onClose }: CampDepositSettingsPanelProps) {
  const currentCamp = useCampsStore(state => state.currentCamp)

  const [savedSettings, setSavedSettings] = useState<CampDepositSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [mode, setMode] = useState<DepositMode>('percentage')
  const [percentageInput, setPercentageInput] = useState<string>('25')
  const [fixedInput, setFixedInput] = useState<string>('')

  const [isSaving, setIsSaving] = useState(false)
  const [percentageTouched, setPercentageTouched] = useState(false)
  const [fixedTouched, setFixedTouched] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const percentageInputRef = useRef<HTMLInputElement>(null)
  const fixedAmountInputRef = useRef<HTMLInputElement>(null)
  const isInitialRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      const response = await getCampDepositSettings(campId)
      if (cancelled) return
      if (response.success && response.data) {
        const s = response.data
        setSavedSettings(s)
        setMode(modeFromSettings(s))
        setPercentageInput(s.depositPercentage != null ? String(s.depositPercentage) : '25')
        setFixedInput(s.depositFixedAmount != null ? String(s.depositFixedAmount) : '')
      }
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [campId])

  useEffect(() => {
    if (isInitialRef.current) {
      isInitialRef.current = false
      return
    }
    if (mode === 'percentage') {
      setTimeout(() => percentageInputRef.current?.focus(), 100)
    } else if (mode === 'fixed') {
      setTimeout(() => fixedAmountInputRef.current?.focus(), 100)
    }
  }, [mode])

  const trimmedPct = percentageInput.trim()
  const parsedPct = trimmedPct === '' ? NaN : Number.parseFloat(trimmedPct)
  const pctIsInteger = !Number.isNaN(parsedPct) && Number.isInteger(parsedPct)
  const pctInRange = pctIsInteger && parsedPct >= 1 && parsedPct <= 100
  const pctInvalid = mode === 'percentage' && !pctInRange
  const pctErrorMessage = pctInvalid
    ? !pctIsInteger && trimmedPct !== ''
      ? 'Percentage must be a whole number'
      : 'Enter a value between 1 and 100'
    : undefined

  const trimmedFixed = fixedInput.trim()
  const parsedFixed = trimmedFixed === '' ? NaN : Number.parseFloat(trimmedFixed)
  const fixedValid = !Number.isNaN(parsedFixed) && parsedFixed > 0
  const fixedInvalid = mode === 'fixed' && !fixedValid
  const fixedErrorMessage = fixedInvalid ? 'Enter an amount greater than 0' : undefined

  const showPctError = pctInvalid && (percentageTouched || submitAttempted)
  const showFixedError = fixedInvalid && (fixedTouched || submitAttempted)

  const isDirty = (() => {
    if (!savedSettings) return false
    const savedMode = modeFromSettings(savedSettings)
    if (mode !== savedMode) return true
    if (mode === 'percentage')
      return Number(percentageInput) !== (savedSettings.depositPercentage ?? null)
    if (mode === 'fixed') return Number(fixedInput) !== (savedSettings.depositFixedAmount ?? null)
    return false
  })()

  const canSave =
    !isSaving &&
    isDirty &&
    (mode === 'none' ||
      (mode === 'percentage' && !pctInvalid) ||
      (mode === 'fixed' && !fixedInvalid))

  const handleSave = async () => {
    setSubmitAttempted(true)
    if (!canSave) return
    setIsSaving(true)
    const payload =
      mode === 'none'
        ? { depositRequired: false }
        : mode === 'percentage'
          ? {
              depositRequired: true,
              depositType: 'percentage' as CampDepositType,
              depositPercentage: parsedPct,
            }
          : {
              depositRequired: true,
              depositType: 'fixed' as CampDepositType,
              depositFixedAmount: parsedFixed,
            }
    const response = await updateCampDepositSettings(campId, payload)
    setIsSaving(false)
    if (!response.success) {
      const message =
        (response as { error?: { message?: string } }).error?.message ??
        'Failed to save deposit settings'
      addToast({ title: 'Error', description: String(message), color: 'danger' })
      return
    }
    if (response.data) {
      setSavedSettings(response.data)
      setSubmitAttempted(false)
    }
    addToast({
      title: 'Saved',
      description: 'Deposit settings updated for this camp.',
      color: 'success',
    })
  }

  if (isLoading) {
    return (
      <div className="fixed inset-y-0 right-0 w-96 lg:w-[480px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-lg z-50 flex items-center justify-center">
        <Spinner size="sm" />
      </div>
    )
  }

  return (
    <div className="fixed inset-y-0 right-0 w-96 lg:w-[480px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 px-6 h-18 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold">Deposit Settings</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        <p className="text-sm text-default-500">
          Per-camp deposit. Inherits provider default; overrides apply to this camp only.
        </p>

        <p className="text-base font-semibold text-foreground">
          Non-refundable deposit
          <span className="ml-1 text-danger">*</span>
        </p>

        <div className="flex flex-col gap-3">
          {/* Percentage */}
          <label
            htmlFor="camp_deposit_percentage"
            className="relative flex cursor-pointer items-start gap-4 rounded-xl border-2 border-default-200 p-5 transition-all hover:border-default-400 has-checked:border-primary has-checked:bg-primary-50"
          >
            <input
              type="radio"
              id="camp_deposit_percentage"
              name="campDepositType"
              value="percentage"
              checked={mode === 'percentage'}
              onChange={() => setMode('percentage')}
              disabled={isSaving}
              className="peer absolute opacity-0"
            />
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-default-100 text-xl transition-colors peer-checked:bg-primary peer-checked:text-secondary">
              %
            </div>
            <div className="flex-1 min-w-0">
              <div className="mb-1 text-sm font-semibold text-foreground">Percentage</div>
              <div className="text-sm leading-relaxed text-default-500">
                Charge a percentage of the booking total at booking.
              </div>

              {mode === 'percentage' && (
                <div
                  className="mt-3 flex flex-wrap items-center gap-3 border-t border-dashed border-default-300 pt-3"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="inline-flex overflow-hidden rounded-lg border-2 border-default-200 bg-background transition-colors focus-within:border-primary">
                    <input
                      ref={percentageInputRef}
                      type="number"
                      value={percentageInput}
                      onChange={e => setPercentageInput(e.target.value)}
                      onBlur={() => setPercentageTouched(true)}
                      min={1}
                      max={100}
                      step={1}
                      disabled={isSaving}
                      className="w-20 border-none px-3.5 py-3 text-center text-lg font-semibold outline-none"
                    />
                    <span className="bg-default-100 px-3.5 py-3 text-base font-semibold text-default-600">
                      %
                    </span>
                  </div>
                  <span className="text-sm text-default-500">of total program price</span>
                </div>
              )}
              {showPctError && <p className="mt-2 text-sm text-danger">{pctErrorMessage}</p>}
            </div>
          </label>

          {/* Fixed amount */}
          <label
            htmlFor="camp_deposit_fixed"
            className="relative flex cursor-pointer items-start gap-4 rounded-xl border-2 border-default-200 p-5 transition-all hover:border-default-400 has-checked:border-primary has-checked:bg-primary-50"
          >
            <input
              type="radio"
              id="camp_deposit_fixed"
              name="campDepositType"
              value="fixed"
              checked={mode === 'fixed'}
              onChange={() => setMode('fixed')}
              disabled={isSaving}
              className="peer absolute opacity-0"
            />
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-default-100 text-xl transition-colors peer-checked:bg-primary">
              💵
            </div>
            <div className="flex-1 min-w-0">
              <div className="mb-1 text-sm font-semibold text-foreground">Fixed amount</div>
              <div className="text-sm leading-relaxed text-default-500">
                Same amount regardless of price.
              </div>

              {mode === 'fixed' && (
                <div
                  className="mt-3 flex flex-wrap items-center gap-3 border-t border-dashed border-default-300 pt-3"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="inline-flex overflow-hidden rounded-lg border-2 border-default-200 bg-background transition-colors focus-within:border-primary">
                    <span className="bg-default-100 px-3.5 py-3 text-base font-semibold text-default-600">
                      {currentCamp ? getCurrencySymbol(currentCamp.currency) : ''}
                    </span>
                    <input
                      ref={fixedAmountInputRef}
                      type="number"
                      value={fixedInput}
                      onChange={e => setFixedInput(e.target.value)}
                      onBlur={() => setFixedTouched(true)}
                      min={0.01}
                      step={0.01}
                      disabled={isSaving}
                      className="w-24 border-none px-3.5 py-3 text-center text-lg font-semibold outline-none"
                    />
                  </div>
                  <span className="text-sm text-default-500">fixed deposit amount</span>
                </div>
              )}
              {showFixedError && <p className="mt-2 text-sm text-danger">{fixedErrorMessage}</p>}
            </div>
          </label>

          {/* No deposit */}
          <label
            htmlFor="camp_deposit_none"
            className="relative flex cursor-pointer items-start gap-4 rounded-xl border-2 border-default-200 p-5 transition-all hover:border-default-400 has-checked:border-primary has-checked:bg-primary-50"
          >
            <input
              type="radio"
              id="camp_deposit_none"
              name="campDepositType"
              value="none"
              checked={mode === 'none'}
              onChange={() => setMode('none')}
              disabled={isSaving}
              className="peer absolute opacity-0"
            />
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-default-100 text-xl transition-colors peer-checked:bg-primary">
              💳
            </div>
            <div className="flex-1 min-w-0">
              <div className="mb-1 text-sm font-semibold text-foreground">No deposit</div>
              <div className="text-sm leading-relaxed text-default-500">
                Charge the full amount at booking.
              </div>
            </div>
          </label>
        </div>

        {mode === 'fixed' && (
          <p className="mt-1 text-sm text-warning">
            Fixed deposits must be less than every session price.
          </p>
        )}

        <Button
          color="primary"
          onPress={handleSave}
          isLoading={isSaving}
          isDisabled={!canSave}
          className="w-full"
        >
          Save
        </Button>
      </div>
    </div>
  )
}
