'use client'

import type { AgeGroupPrice, PricingType } from '@/types/sessions'
import { formatCurrency } from '@/utils/sessionFormatters'

interface SessionPricingDisplayProps {
  pricingType: PricingType
  price?: number
  ageGroupPrices?: AgeGroupPrice[]
  currency?: string
  variant?: 'chips' | 'text' | 'compact'
}

/**
 * Session Pricing Display Component
 * Displays pricing information for sessions
 * Supports both single and age group pricing
 */
export function SessionPricingDisplay({
  pricingType,
  price,
  ageGroupPrices,
  currency = 'USD',
  variant = 'chips',
}: SessionPricingDisplayProps) {
  // For single pricing
  if (pricingType === 'single' && price !== undefined) {
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

  // For age group pricing
  if (pricingType === 'age_group' && ageGroupPrices && ageGroupPrices.length > 0) {
    const minPrice = Math.min(...ageGroupPrices.map(ag => ag.price))
    const maxPrice = Math.max(...ageGroupPrices.map(ag => ag.price))

    if (variant === 'compact') {
      return (
        <div className="text-right">
          <div className="text-[18px] font-bold text-default-900">
            {minPrice === maxPrice
              ? formatCurrency(minPrice, currency)
              : `${formatCurrency(minPrice, currency)} - ${formatCurrency(maxPrice, currency)}`}
          </div>
        </div>
      )
    }

    return (
      <div className="text-right">
        <div className="text-[20px] font-bold text-default-900">
          {minPrice === maxPrice
            ? formatCurrency(minPrice, currency)
            : `${formatCurrency(minPrice, currency)} - ${formatCurrency(maxPrice, currency)}`}
        </div>
        <div className="text-[12px] text-default-500">per session (varies by age group)</div>
      </div>
    )
  }

  return <div className="text-[14px] text-default-400 italic">No pricing set</div>
}
