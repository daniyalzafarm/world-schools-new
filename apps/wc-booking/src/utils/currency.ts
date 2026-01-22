/**
 * Currency formatting utilities for wc-booking app
 */

/**
 * Format currency with proper symbol and formatting
 * Uses Intl.NumberFormat for proper internationalization
 */
export function formatCurrency(amount: number, currencyCode = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch (error) {
    // Fallback to simple formatting if currency code is invalid
    console.warn(`Invalid currency code: ${currencyCode}, falling back to symbol mapping`)
    return formatCurrencyFallback(amount, currencyCode)
  }
}

/**
 * Fallback currency formatting using symbol mapping
 * Used when Intl.NumberFormat fails or for custom formatting
 */
function formatCurrencyFallback(amount: number, currencyCode: string): string {
  const formatted = Math.round(amount).toLocaleString('en-US')

  // Currency symbol mapping
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    CHF: 'CHF',
    CAD: 'C$',
    AUD: 'A$',
    JPY: '¥',
    CNY: '¥',
    INR: '₹',
    BRL: 'R$',
    MXN: 'MX$',
    ZAR: 'R',
    SGD: 'S$',
    HKD: 'HK$',
    NZD: 'NZ$',
    SEK: 'kr',
    NOK: 'kr',
    DKK: 'kr',
    PLN: 'zł',
    CZK: 'Kč',
    HUF: 'Ft',
    RON: 'lei',
    TRY: '₺',
    ILS: '₪',
    AED: 'AED',
    SAR: 'SAR',
    KRW: '₩',
    THB: '฿',
    MYR: 'RM',
    IDR: 'Rp',
    PHP: '₱',
    VND: '₫',
  }

  const symbol = symbols[currencyCode] || currencyCode

  // For currencies that typically use symbol after amount
  const symbolAfterCurrencies = ['SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON']

  if (symbolAfterCurrencies.includes(currencyCode)) {
    return `${formatted} ${symbol}`
  }

  return `${symbol}${formatted}`
}

/**
 * Get currency symbol for a given currency code
 */
export function getCurrencySymbol(currencyCode: string): string {
  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0)

    // Extract symbol by removing the number
    return formatted.replace(/[\d,.\s]/g, '')
  } catch (error) {
    // Fallback to symbol mapping
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      CHF: 'CHF',
      CAD: 'C$',
      AUD: 'A$',
    }
    return symbols[currencyCode] || currencyCode
  }
}
