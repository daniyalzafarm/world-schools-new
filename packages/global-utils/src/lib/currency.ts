/**
 * Shared currency utilities (cross-product, isomorphic — backend + frontend + ui-web).
 *
 * This is the single source of truth for the platform's supported currencies,
 * their display symbols, and formatting. It lives in `global-utils` (not the
 * World-Camps-specific `wc-utils`) so that product-agnostic packages such as
 * `ui-web` can consume it without taking a dependency on a product package.
 *
 * `wc-utils` re-exports these helpers for backward compatibility, and the
 * backend derives its Stripe Connect currency allow-list from
 * {@link SUPPORTED_CURRENCIES}.
 */

/**
 * ISO 4217 codes (upper-case) the platform officially supports for provider
 * settlement. A provider's currency is locked at onboarding and they price
 * camps/add-ons only in this currency.
 *
 * The original four (CHF/EUR/GBP/USD) match the platform's external bank
 * accounts. The rest settle into the platform's default (CHF) account on
 * platform payout, with the platform absorbing the FX — neither the provider
 * nor the customer pays a Stripe FX margin (see the Stripe Connect comment in
 * `apps/wc-nest-api/.../stripe/stripe.constants.ts`).
 */
export const SUPPORTED_CURRENCIES = [
  'CHF',
  'EUR',
  'GBP',
  'USD',
  'CAD',
  'AED',
  'AUD',
  'SGD',
  'JPY',
  'CNY',
  'HKD',
  'DKK',
  'SEK',
  'THB',
  'NZD',
] as const

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

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
