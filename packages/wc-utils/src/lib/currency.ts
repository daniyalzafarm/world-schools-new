/**
 * Shared currency formatting (frontend + isomorphic utilities).
 */

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

export function formatCurrency(amount: number, currencyCode = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return formatCurrencyFallback(amount, currencyCode)
  }
}

function formatCurrencyFallback(amount: number, currencyCode: string): string {
  const formatted = Math.round(amount).toLocaleString('en-US')

  const symbol = symbols[currencyCode] || currencyCode
  const symbolAfterCurrencies = ['SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON']

  if (symbolAfterCurrencies.includes(currencyCode)) {
    return `${formatted} ${symbol}`
  }

  return `${symbol}${formatted}`
}

export function getCurrencySymbol(currencyCode: string): string {
  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0)

    return formatted.replace(/[\d,.\s]/g, '')
  } catch {
    return symbols[currencyCode] || currencyCode
  }
}
