export { formatCurrency, getCurrencySymbol } from '@world-schools/wc-utils'

/**
 * Pulls the settlement currency from a camp (provider's currency). Every
 * published camp is required to have a provider currency configured at
 * onboarding — a missing value here indicates a data bug, not a steady
 * state we should paper over by guessing a currency.
 *
 * In development, throws to surface the bug; in production, logs a warning
 * and falls back to the platform's reference currency (CHF — the operator's
 * home currency) so the page does not crash.
 */
export function getCampCurrency(
  camp: { provider?: { settings?: { currency?: string | null } | null } | null } | null | undefined,
  contextHint = 'camp'
): string {
  const currency = camp?.provider?.settings?.currency
  if (currency) return currency
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(`Missing provider currency on ${contextHint}; check provider onboarding state`)
  }
  console.warn(`[currency] Missing provider currency on ${contextHint}; falling back to CHF`)
  return 'CHF'
}
