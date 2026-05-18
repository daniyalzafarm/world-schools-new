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
  Switch,
} from '@heroui/react'
import { providersService } from '@/services/providers.services'

interface AppFeeModalProps {
  isOpen: boolean
  onClose: () => void
  providerId: string
  currentCustom: boolean
  currentPercentage: number | null
  systemDefault: number
  onSaved?: () => void
}

export const AppFeeModal: React.FC<AppFeeModalProps> = ({
  isOpen,
  onClose,
  providerId,
  currentCustom,
  currentPercentage,
  systemDefault,
  onSaved,
}) => {
  const [custom, setCustom] = useState(currentCustom)
  const [percentageInput, setPercentageInput] = useState<string>(
    currentPercentage != null ? String(currentPercentage) : ''
  )
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setCustom(currentCustom)
      setPercentageInput(currentPercentage != null ? String(currentPercentage) : '')
    }
  }, [isOpen, currentCustom, currentPercentage])

  // Reject locale-formatted commas ("12,5") and other non-numeric noise BEFORE
  // parseFloat — `Number.parseFloat("12,5")` returns 12, silently truncating
  // the fractional part. The regex matches a plain decimal: optional digits +
  // optional ".digits" tail. Empty string is treated as not-yet-entered.
  const trimmedPercentage = percentageInput.trim()
  const percentageFormatOk = /^\d+(\.\d+)?$/.test(trimmedPercentage)
  const parsedPercentage =
    trimmedPercentage === '' || !percentageFormatOk ? NaN : Number.parseFloat(trimmedPercentage)
  const percentageInvalid =
    custom && (Number.isNaN(parsedPercentage) || parsedPercentage < 0 || parsedPercentage > 50)
  const percentageErrorMessage = percentageInvalid
    ? trimmedPercentage !== '' && !percentageFormatOk
      ? 'Use a period (12.5) — commas are not accepted'
      : 'Enter a value between 0 and 50'
    : undefined
  const canSave = !isSaving && (!custom || !percentageInvalid)

  const handleSave = async () => {
    if (!canSave) return
    setIsSaving(true)
    try {
      await providersService.setAppFee(providerId, {
        custom,
        ...(custom ? { appFeePercentage: parsedPercentage } : {}),
      })
      addToast({ title: 'Saved', description: 'App fee updated.', color: 'success' })
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
    <Modal isOpen={isOpen} onClose={handleClose} size="md" placement="center">
      <ModalContent>
        <ModalHeader className="text-xl font-semibold">App Fee</ModalHeader>
        <ModalBody className="gap-5">
          <div className="flex items-center justify-between rounded-lg border border-default-200 px-3 py-2.5">
            <div>
              <div className="text-sm font-medium">Use a custom app fee</div>
              <div className="text-xs text-default-500">System default: {systemDefault}%</div>
            </div>
            <Switch isSelected={custom} onValueChange={setCustom} isDisabled={isSaving} />
          </div>

          {custom && (
            <Input
              label="App fee percentage"
              labelPlacement="outside"
              placeholder="e.g. 12.5"
              type="number"
              min={0}
              max={50}
              step={0.01}
              value={percentageInput}
              onValueChange={setPercentageInput}
              endContent={<span className="text-sm text-default-400">%</span>}
              isInvalid={percentageInvalid}
              errorMessage={percentageErrorMessage}
              isDisabled={isSaving}
              autoFocus
            />
          )}

          <div className="rounded-md border border-default-200 bg-default-50 p-3 text-xs text-default-600">
            This applies to <strong>future bookings only</strong>. Existing bookings keep their
            original app fee rate.
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
