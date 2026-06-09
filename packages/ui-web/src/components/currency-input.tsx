'use client'

import React, { useState } from 'react'
import { getCurrencySymbol } from '@world-schools/global-utils/currency'
import { Input } from './input'
import type { CustomInputProps } from './input'

export interface CurrencyInputProps extends Omit<
  CustomInputProps,
  'value' | 'onValueChange' | 'type'
> {
  value?: number | null
  onValueChange?: (value: number | null) => void
  /** ISO 4217 currency code. Required — no silent default. */
  currency: string
  min?: number
  max?: number
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onValueChange,
  currency,
  min = 0,
  max,
  ...props
}) => {
  const [displayValue, setDisplayValue] = useState(() =>
    value !== null && value !== undefined ? value.toString() : ''
  )
  const [prevValue, setPrevValue] = useState(value)

  // Sync displayValue when value prop changes (e.g. form reset) — React "adjusting state when a prop changes" pattern
  if (value !== prevValue) {
    setPrevValue(value)
    setDisplayValue(value !== null && value !== undefined ? value.toString() : '')
  }

  const formatCurrency = (val: string): string => {
    // Remove non-numeric characters except decimal point
    const cleaned = val.replace(/[^\d.]/g, '')

    // Ensure only one decimal point
    const parts = cleaned.split('.')
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('')
    }

    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + '.' + parts[1].slice(0, 2)
    }

    return cleaned
  }

  const handleChange = (val: string) => {
    const formatted = formatCurrency(val)
    setDisplayValue(formatted)

    const numValue = formatted === '' ? null : parseFloat(formatted)

    // Validate min/max
    if (numValue !== null) {
      if (min !== undefined && numValue < min) return
      if (max !== undefined && numValue > max) return
    }

    onValueChange?.(numValue)
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onValueChange={handleChange}
      startContent={<span className="text-sm text-default-500">{getCurrencySymbol(currency)}</span>}
    />
  )
}
