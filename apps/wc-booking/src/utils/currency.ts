export { formatCurrency, getCurrencySymbol } from '@world-schools/wc-utils'

/**
 * Pulls the settlement currency from a camp (provider's currency). Every
 * published camp is required to have a provider currency configured at
 * onboarding — a missing value on a *loaded* camp indicates a data bug, not a
 * steady state we should paper over by guessing a currency.
 *
 * A `null`/`undefined` camp is different: it's the expected transient state
 * while the booking flow's async init is still fetching the camp, so we fall
 * back quietly and let the component re-render with the real currency once the
 * camp resolves.
 *
 * For a loaded camp with no currency: in development, throws to surface the
 * bug; in production, logs a warning and falls back to the platform's reference
 * currency (CHF — the operator's home currency) so the page does not crash.
 */
export function getCampCurrency(
  camp: { provider?: { settings?: { currency?: string | null } | null } | null } | null | undefined,
  contextHint = 'camp'
): string {
  const currency = camp?.provider?.settings?.currency
  if (currency) return currency

  // Camp not loaded yet — an expected transient state during the booking flow's
  // async init, not a data bug. Fall back quietly; the component re-renders with
  // the real currency once the camp resolves.
  if (!camp) return 'CHF'

  // Camp is loaded but the provider has no currency configured — a genuine data
  // bug (provider onboarding incomplete). Surface it loudly in dev.
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(`Missing provider currency on ${contextHint}; check provider onboarding state`)
  }
  console.warn(`[currency] Missing provider currency on ${contextHint}; falling back to CHF`)
  return 'CHF'
}
