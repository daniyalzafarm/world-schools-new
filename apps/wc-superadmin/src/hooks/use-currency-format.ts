import { useCallback } from 'react'

/**
 * Formats numeric values as currency strings via Intl.NumberFormat. Falls back
 * to a plain number when the currency code is invalid. Used across both
 * dashboards so a single currency change in the store updates every formatted
 * value.
 */
export function useCurrencyFormat(currency: string | undefined) {
  return useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => {
      return formatAmount(value, currency, options)
    },
    [currency]
  )
}

/**
 * Pure formatter accepting the currency per call. Use this when a list/table
 * renders rows in different currencies (e.g. the All Currencies view), where
 * the hook's locked-in currency would force everything into one symbol.
 */
export function formatAmount(
  value: number,
  currency: string | undefined,
  options?: Intl.NumberFormatOptions
): string {
  if (!currency) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(value)
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      currencyDisplay: 'symbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(value)
  } catch {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}
