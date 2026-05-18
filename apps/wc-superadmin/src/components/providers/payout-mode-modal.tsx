'use client'

import React, { useEffect, useState } from 'react'
import {
  addToast,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Radio,
  RadioGroup,
  Textarea,
} from '@heroui/react'
import { type ProviderPayoutMode, providersService } from '@/services/providers.services'

interface PayoutModeModalProps {
  isOpen: boolean
  onClose: () => void
  providerId: string
  currentMode: ProviderPayoutMode
  currentOffsetDays: number | null
  currentAgreementNote: string | null
  onSaved?: () => void
}

const NOTE_MAX = 2000

const MODE_LABELS: Record<ProviderPayoutMode, string> = {
  default_after_start: 'Default — single payout after camp starts',
  offset_days: 'Early payout — single payout X days before camp starts',
  policy_staged: 'Policy staged — multiple payouts as funds become non-refundable',
}

const MODE_DESCRIPTIONS: Record<ProviderPayoutMode, string> = {
  default_after_start:
    'One payout on the first business day after camp starts. Default for all providers.',
  offset_days:
    'One payout for the full amount, X days before the camp starts (regardless of cancellation policy). Carries reimbursement risk if a refund is needed after release.',
  policy_staged:
    "Multiple payouts driven by the provider's deposit + cancellation policy. The deposit releases at the 48h grace boundary; each policy tier releases the increment that becomes non-refundable.",
}

export const PayoutModeModal: React.FC<PayoutModeModalProps> = ({
  isOpen,
  onClose,
  providerId,
  currentMode,
  currentOffsetDays,
  currentAgreementNote,
  onSaved,
}) => {
  const [mode, setMode] = useState<ProviderPayoutMode>(currentMode)
  const [offsetInput, setOffsetInput] = useState<string>(
    currentOffsetDays != null ? String(currentOffsetDays) : ''
  )
  const [note, setNote] = useState<string>(currentAgreementNote ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [offsetTouched, setOffsetTouched] = useState(false)
  const [noteTouched, setNoteTouched] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMode(currentMode)
      setOffsetInput(currentOffsetDays != null ? String(currentOffsetDays) : '')
      setNote(currentAgreementNote ?? '')
      setOffsetTouched(false)
      setNoteTouched(false)
      setSubmitAttempted(false)
    }
  }, [isOpen, currentMode, currentOffsetDays, currentAgreementNote])

  const trimmedOffset = offsetInput.trim()
  const parsedOffset = trimmedOffset === '' ? NaN : Number.parseFloat(trimmedOffset)
  const offsetIsInteger = !Number.isNaN(parsedOffset) && Number.isInteger(parsedOffset)
  const offsetInRange = offsetIsInteger && parsedOffset >= 1 && parsedOffset <= 365
  const offsetInvalid = mode === 'offset_days' && !offsetInRange
  const offsetErrorMessage = offsetInvalid
    ? !offsetIsInteger && trimmedOffset !== ''
      ? 'Days must be a whole number'
      : 'Enter a value between 1 and 365'
    : undefined
  const noteRequired = mode !== 'default_after_start'
  const noteInvalid = noteRequired && note.trim().length === 0

  const canSave = !isSaving && !offsetInvalid && !noteInvalid

  const showOffsetError = offsetInvalid && (offsetTouched || submitAttempted)
  const showNoteError = noteInvalid && (noteTouched || submitAttempted)

  const handleSave = async () => {
    setSubmitAttempted(true)
    if (!canSave) return
    setIsSaving(true)
    try {
      const payload =
        mode === 'default_after_start'
          ? { payoutMode: mode }
          : {
              payoutMode: mode,
              ...(mode === 'offset_days' ? { offsetDays: parsedOffset } : {}),
              agreementNote: note.trim(),
            }
      await providersService.setPayoutMode(providerId, payload)
      addToast({ title: 'Saved', description: 'Payout mode updated.', color: 'success' })
      onSaved?.()
      onClose()
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.message ?? 'Failed to save'
      addToast({ title: 'Error', description: String(message), color: 'danger' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    if (!isSaving) onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="2xl" placement="center">
      <ModalContent>
        <ModalHeader className="text-xl font-semibold">Payout Mode</ModalHeader>
        <ModalBody className="gap-5">
          <RadioGroup
            value={mode}
            onValueChange={v => setMode(v as ProviderPayoutMode)}
            isDisabled={isSaving}
          >
            {(Object.keys(MODE_LABELS) as ProviderPayoutMode[]).map(m => (
              <Radio key={m} value={m} description={MODE_DESCRIPTIONS[m]}>
                {MODE_LABELS[m]}
              </Radio>
            ))}
          </RadioGroup>

          {mode === 'offset_days' && (
            <Input
              label="Release funds N days before session start"
              labelPlacement="outside"
              placeholder="e.g. 7"
              type="number"
              min={1}
              max={365}
              step={1}
              value={offsetInput}
              onValueChange={setOffsetInput}
              onBlur={() => setOffsetTouched(true)}
              endContent={<span className="text-sm text-default-400">days</span>}
              isInvalid={showOffsetError}
              errorMessage={showOffsetError ? offsetErrorMessage : undefined}
              isDisabled={isSaving}
            />
          )}

          {mode !== 'default_after_start' && (
            <Textarea
              label="Written agreement reference / notes"
              labelPlacement="outside"
              placeholder="Paste agreement filename, contract ID, email subject, etc."
              value={note}
              onValueChange={setNote}
              onBlur={() => setNoteTouched(true)}
              minRows={3}
              maxLength={NOTE_MAX}
              isInvalid={showNoteError}
              errorMessage={
                showNoteError ? 'A reference to the written agreement is required' : undefined
              }
              isDisabled={isSaving}
            />
          )}

          {mode === 'offset_days' && (
            <div className="rounded-md border border-warning-200 bg-warning-50 p-3 text-xs text-warning-700">
              Funds will be released to the provider <strong>before camp starts</strong>.
              Reimbursement risk applies if a refund is needed after payout.
            </div>
          )}

          {mode === 'policy_staged' && (
            <div className="rounded-md border border-warning-200 bg-warning-50 p-3 text-xs text-warning-700">
              Each tranche releases as the matching cancellation-policy tier turns its share
              non-refundable. The provider&apos;s existing deposit + cancellation-policy settings
              determine the schedule shape.
            </div>
          )}

          <div className="rounded-md border border-default-200 bg-default-50 p-3 text-xs text-default-600">
            This applies to <strong>future bookings only</strong>. Existing bookings keep their
            originally-snapshotted mode.
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={handleClose} isDisabled={isSaving}>
            Cancel
          </Button>
          <Button color="secondary" onPress={handleSave} isLoading={isSaving} isDisabled={!canSave}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
