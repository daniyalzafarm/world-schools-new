'use client'

import { formatCurrency } from '@/utils/sessionFormatters'

interface SessionPricingDisplayProps {
  price?: number
  currency?: string
  variant?: 'chips' | 'text' | 'compact'
}

/**
 * Session Pricing Display Component
 * Displays pricing information for sessions
 * For fixed sessions: shows single price
 */
export function SessionPricingDisplay({
  price,
  currency = 'USD',
  variant = 'chips',
}: SessionPricingDisplayProps) {
  // For fixed sessions (single price)
  if (price !== undefined) {
    if (variant === 'compact') {
      return (
        <div className="text-right">
          <div className="text-[18px] font-bold text-default-900">
            {formatCurrency(price, currency)}
          </div>
        </div>
      )
    }

    return (
      <div className="text-right">
        <div className="text-[20px] font-bold text-default-900">
          {formatCurrency(price, currency)}
        </div>
        <div className="text-[12px] text-default-500">per session</div>
      </div>
    )
  }

  return <div className="text-[14px] text-default-400 italic">No pricing set</div>
}
