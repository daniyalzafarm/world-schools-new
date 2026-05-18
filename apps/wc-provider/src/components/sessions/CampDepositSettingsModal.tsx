'use client'

import { useEffect, useRef, useState } from 'react'
import {
  addToast,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import { getCurrencySymbol } from '@world-schools/wc-utils'
import {
  type CampDepositSettings,
  type CampDepositType,
  updateCampDepositSettings,
} from '@/services/camps.services'

interface CampDepositSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  campId: string
  initialSettings: CampDepositSettings
  currency: string
  onSaved: (settings: CampDepositSettings) => void
}

type DepositMode = 'none' | 'percentage' | 'fixed'

function modeFromSettings(s: CampDepositSettings): DepositMode {
  if (!s.depositRequired) return 'none'
  return s.depositType === 'fixed' ? 'fixed' : 'percentage'
}

export function CampDepositSettingsModal({
  isOpen,
  onClose,
  campId,
  initialSettings,
  currency,
  onSaved,
}: CampDepositSettingsModalProps) {
  const [mode, setMode] = useState<DepositMode>(modeFromSettings(initialSettings))
  const [percentageInput, setPercentageInput] = useState<string>(
    initialSettings.depositPercentage != null ? String(initialSettings.depositPercentage) : '25'
  )
  const [fixedInput, setFixedInput] = useState<string>(
    initialSettings.depositFixedAmount != null ? String(initialSettings.depositFixedAmount) : ''
  )

  const [isSaving, setIsSaving] = useState(false)
  const [percentageTouched, setPercentageTouched] = useState(false)
  const [fixedTouched, setFixedTouched] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const percentageInputRef = useRef<HTMLInputElement>(null)
  const fixedAmountInputRef = useRef<HTMLInputElement>(null)
  const isInitialRef = useRef(true)
  const wasOpenRef = useRef(isOpen)

  // Re-seed working state from initialSettings whenever the modal opens.
  // Without this, edit-cancel-reopen leaks abandoned edits into the next session.
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setMode(modeFromSettings(initialSettings))
      setPercentageInput(
        initialSettings.depositPercentage != null ? String(initialSettings.depositPercentage) : '25'
      )
      setFixedInput(
        initialSettings.depositFixedAmount != null ? String(initialSettings.depositFixedAmount) : ''
      )
      setPercentageTouched(false)
      setFixedTouched(false)
      setSubmitAttempted(false)
      isInitialRef.current = true
    }
    wasOpenRef.current = isOpen
  }, [isOpen, initialSettings])

  // Auto-focus the active input ~100ms after mode change (skip on initial open).
  useEffect(() => {
    if (!isOpen) return
    if (isInitialRef.current) {
      isInitialRef.current = false
      return
    }
    if (mode === 'percentage') {
      setTimeout(() => percentageInputRef.current?.focus(), 100)
    } else if (mode === 'fixed') {
      setTimeout(() => fixedAmountInputRef.current?.focus(), 100)
    }
  }, [mode, isOpen])

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

  const savedMode = modeFromSettings(initialSettings)
  const isDirty = (() => {
    if (mode !== savedMode) return true
    if (mode === 'percentage')
      return Number(percentageInput) !== (initialSettings.depositPercentage ?? null)
    if (mode === 'fixed') return Number(fixedInput) !== (initialSettings.depositFixedAmount ?? null)
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
      onSaved(response.data)
    }
    addToast({
      title: 'Saved',
      description: 'Deposit settings updated for this camp.',
      color: 'success',
    })
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      placement="center"
      backdrop="opaque"
      classNames={{
        backdrop: 'bg-black/50 z-[200]',
        wrapper: 'z-[200]',
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-foreground">Deposit Settings</h2>
          <p className="text-sm font-normal text-default-500">
            Per-camp deposit. Inherits provider default; overrides apply to this camp only.
          </p>
        </ModalHeader>
        <ModalBody>
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
              <div className="flex-1">
                <div className="mb-1 text-sm font-semibold text-foreground">Percentage</div>
                <div className="text-sm leading-relaxed text-default-500">
                  Charge a percentage of the booking total at booking.
                </div>

                {mode === 'percentage' && (
                  <div
                    className="mt-3 flex items-center gap-3 border-t border-dashed border-default-300 pt-3"
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
                        className="w-24 border-none px-3.5 py-3 text-center text-lg font-semibold outline-none"
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
              <div className="flex-1">
                <div className="mb-1 text-sm font-semibold text-foreground">Fixed amount</div>
                <div className="text-sm leading-relaxed text-default-500">
                  Same amount regardless of price.
                </div>

                {mode === 'fixed' && (
                  <div
                    className="mt-3 flex items-center gap-3 border-t border-dashed border-default-300 pt-3"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="inline-flex overflow-hidden rounded-lg border-2 border-default-200 bg-background transition-colors focus-within:border-primary">
                      <span className="bg-default-100 px-3.5 py-3 text-base font-semibold text-default-600">
                        {getCurrencySymbol(currency)}
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
              <div className="flex-1">
                <div className="mb-1 text-sm font-semibold text-foreground">No deposit</div>
                <div className="text-sm leading-relaxed text-default-500">
                  Charge the full amount at booking.
                </div>
              </div>
            </label>
          </div>

          <p className="mt-1 text-xs text-default-500">
            Fixed deposits must be less than every session price.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={isSaving}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSave} isLoading={isSaving} isDisabled={!canSave}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
