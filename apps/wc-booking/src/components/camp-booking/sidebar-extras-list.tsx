'use client'

import type { AddOnExtrasRow } from '@/components/camp-booking/booking-flow-pricing'
import { formatCurrency } from '@/utils/currency'

interface SidebarExtrasListProps {
  extrasRows: AddOnExtrasRow[]
  currency: string
  pricePrefix?: '' | '+'
}

export function SidebarExtrasList({
  extrasRows,
  currency,
  pricePrefix = '',
}: SidebarExtrasListProps) {
  if (extrasRows.length === 0) return null
  return (
    <>
      <div className="pt-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Extras
      </div>
      {extrasRows.map(row => (
        <div key={row.key} className="flex items-center justify-between text-sm text-gray-700">
          <span>{row.label}</span>
          <span>
            {pricePrefix}
            {formatCurrency(row.total, currency)}
          </span>
        </div>
      ))}
    </>
  )
}
