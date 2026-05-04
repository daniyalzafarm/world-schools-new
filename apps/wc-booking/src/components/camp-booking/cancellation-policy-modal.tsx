'use client'

import { useMemo } from 'react'
import { Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react'
import { Check, CircleAlert, X } from 'lucide-react'
import type { CancellationPolicyCustomData } from '@world-schools/wc-types'
import { buildCancellationPolicyRows, getRefundAmount } from '@world-schools/wc-utils'
import { formatCurrency } from '@/utils/currency'

export interface CancellationPolicyModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  cancellationPolicy?: string | null
  cancellationPolicyCustom?: CancellationPolicyCustomData | null
  sessionStartDate?: string | Date | null
  bookingTotal?: number | null
  currency?: string | null
}

export function CancellationPolicyModal({
  isOpen,
  onOpenChange,
  cancellationPolicy,
  cancellationPolicyCustom,
  sessionStartDate,
  bookingTotal,
  currency,
}: CancellationPolicyModalProps) {
  const rows = useMemo(
    () =>
      buildCancellationPolicyRows(cancellationPolicy, cancellationPolicyCustom, sessionStartDate),
    [cancellationPolicy, cancellationPolicyCustom, sessionStartDate]
  )

  const hasAmounts = typeof bookingTotal === 'number' && bookingTotal > 0
  const currencyCode = currency ?? 'EUR'
  const formattedTotal = hasAmounts ? formatCurrency(bookingTotal, currencyCode) : null

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="md" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>
          <h3 className="text-lg font-semibold">Cancellation policy</h3>
        </ModalHeader>
        <ModalBody className="pb-6">
          <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
            {formattedTotal ? (
              <>
                Below shows what you get back from your{' '}
                <strong className="text-gray-900">{formattedTotal} booking</strong> if you cancel.
              </>
            ) : (
              <>Below shows what you get back from your booking if you cancel.</>
            )}
          </div>
          <div className="mt-2 divide-y divide-gray-200">
            {rows.map(row => {
              const Icon =
                row.refundPercentage === 100 ? Check : row.refundPercentage === 0 ? X : CircleAlert
              const iconColor =
                row.refundPercentage === 100
                  ? 'text-success-600'
                  : row.refundPercentage === 0
                    ? 'text-gray-500'
                    : 'text-gray-700'
              const amountText = hasAmounts
                ? formatCurrency(getRefundAmount(bookingTotal, row.refundPercentage), currencyCode)
                : null
              const primary = row.dateRangeLabel ?? row.rangeLabel
              const secondary = row.dateRangeLabel ? row.rangeLabel : null
              return (
                <div
                  key={`${row.daysBeforeStart}-${row.refundPercentage}`}
                  className="flex items-start gap-3 py-4"
                >
                  <Icon size={20} className={`mt-0.5 shrink-0 ${iconColor}`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{primary}</p>
                    {secondary ? <p className="text-xs text-gray-500">{secondary}</p> : null}
                  </div>
                  <div className="text-right">
                    {amountText ? (
                      <p
                        className={`text-base font-bold ${
                          row.refundPercentage === 100 ? 'text-success-600' : 'text-gray-900'
                        }`}
                      >
                        {amountText}
                      </p>
                    ) : null}
                    <p className="text-xs text-gray-500">{row.refundLabel}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
