'use client'

import { Chip } from '@heroui/react'
import type { Duration } from '@/types/sessions'
import { formatCurrency, formatDuration } from '@/utils/sessionFormatters'

interface SessionPricingDisplayProps {
  durations?: Duration[]
  price?: number
  currency?: string
  variant?: 'chips' | 'text' | 'compact'
}

/**
 * Session Pricing Display Component
 * Displays pricing information for sessions
 * For flexible sessions: shows duration chips with prices
 * For fixed sessions: shows single price
 */
export function SessionPricingDisplay({
  durations,
  price,
  currency = 'USD',
  variant = 'chips',
}: SessionPricingDisplayProps) {
  // For fixed sessions (single price)
  if (price !== undefined && !durations) {
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

  // For flexible sessions (multiple durations)
  if (durations && durations.length > 0) {
    if (variant === 'chips') {
      return (
        <div className="flex flex-wrap gap-2">
          {durations
            .sort((a, b) => a.weeks - b.weeks)
            .map((duration, index) => (
              <Chip
                key={index}
                size="sm"
                variant="flat"
                className="bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 font-semibold"
              >
                {formatDuration(duration.weeks, duration.days)} -{' '}
                {formatCurrency(duration.price, currency)}
              </Chip>
            ))}
        </div>
      )
    }

    if (variant === 'compact') {
      const minPrice = Math.min(...durations.map(d => d.price))
      const maxPrice = Math.max(...durations.map(d => d.price))

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

    // Text variant
    return (
      <div className="space-y-1">
        {durations
          .sort((a, b) => a.weeks - b.weeks)
          .map((duration, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="text-[14px] text-default-600">
                {formatDuration(duration.weeks, duration.days)}
              </span>
              <span className="text-[16px] font-semibold text-default-900">
                {formatCurrency(duration.price, currency)}
              </span>
            </div>
          ))}
      </div>
    )
  }

  return <div className="text-[14px] text-default-400 italic">No pricing set</div>
}
