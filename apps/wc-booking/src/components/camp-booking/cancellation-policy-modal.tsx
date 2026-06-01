'use client'

import { useMemo } from 'react'
import { Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react'
import { Check, CircleAlert, X } from 'lucide-react'
import type { CancellationPolicyCustomData } from '@world-schools/wc-types'
import {
  buildCancellationPolicyRows,
  getRefundAmount,
  GRACE_PERIOD_HOURS,
} from '@world-schools/wc-utils'
import { formatCurrency } from '@/utils/currency'

export interface CancellationPolicyModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  cancellationPolicy?: string | null
  cancellationPolicyCustom?: CancellationPolicyCustomData | null
  sessionStartDate?: string | Date | null
  bookingTotal?: number | null
  /**
   * Non-refundable deposit amount in major units. When provided, per-row
   * refund amounts are computed against (bookingTotal - depositAmount), since
   * the policy tiers apply to the balance only — the deposit is forfeit
   * once the 48h grace period closes. Pass null/undefined for camps with
   * no deposit (the modal then applies tier % to the full booking total).
   */
  depositAmount?: number | null
  currency: string
}

export function CancellationPolicyModal({
  isOpen,
  onOpenChange,
  cancellationPolicy,
  cancellationPolicyCustom,
  sessionStartDate,
  bookingTotal,
  depositAmount,
  currency,
}: CancellationPolicyModalProps) {
  const rows = useMemo(
    () =>
      buildCancellationPolicyRows(cancellationPolicy, cancellationPolicyCustom, sessionStartDate),
    [cancellationPolicy, cancellationPolicyCustom, sessionStartDate]
  )

  const hasAmounts = typeof bookingTotal === 'number' && bookingTotal > 0
  const formattedTotal = hasAmounts ? formatCurrency(bookingTotal, currency) : null
  const hasDeposit = typeof depositAmount === 'number' && depositAmount > 0
  // Tiers apply to the balance only — deposit is non-refundable post-grace.
  // Without subtracting the deposit, every row would overstate the refund.
  const refundBasis = hasAmounts
    ? hasDeposit
      ? Math.max(0, bookingTotal - depositAmount)
      : bookingTotal
    : null
  const formattedDeposit = hasDeposit ? formatCurrency(depositAmount, currency) : null

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
          {hasDeposit ? (
            <p className="mt-3 text-xs text-gray-500">
              Refund amounts are calculated on the balance only. Your{' '}
              {formattedDeposit ?? 'deposit'} deposit is non-refundable after the{' '}
              {GRACE_PERIOD_HOURS}-hour grace period.
            </p>
          ) : null}
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
              const amountText =
                refundBasis != null
                  ? formatCurrency(getRefundAmount(refundBasis, row.refundPercentage), currency)
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
