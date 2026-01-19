'use client'

import React, { useState, useEffect } from 'react'
import { Input } from './input'
import type { CustomInputProps } from './input'

export interface CurrencyInputProps extends Omit<CustomInputProps, 'value' | 'onValueChange' | 'type'> {
  value?: number | null
  onValueChange?: (value: number | null) => void
  currency?: string
  min?: number
  max?: number
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onValueChange,
  currency = 'USD',
  min = 0,
  max,
  ...props
}) => {
  const [displayValue, setDisplayValue] = useState('')

  useEffect(() => {
    if (value !== null && value !== undefined) {
      setDisplayValue(value.toString())
    } else {
      setDisplayValue('')
    }
  }, [value])

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

  const getCurrencySymbol = (curr: string): string => {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      CAD: 'C$',
      AUD: 'A$',
    }
    return symbols[curr] || curr
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onValueChange={handleChange}
      startContent={
        <span className="text-sm text-default-500">{getCurrencySymbol(currency)}</span>
      }
    />
  )
}

