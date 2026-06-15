import { SUPPORTED_CURRENCIES } from '@world-schools/global-utils/currency'
import { SUPPORTED_CONNECT_CURRENCIES } from './stripe.constants'

/**
 * Currency drift guard (Payments revamp, Spec v2.3 §11).
 *
 * The platform supports all 15 settlement currencies end-to-end. This test pins
 * the set so a silent re-restriction to the original four (CHF/EUR/GBP/USD) — or
 * any divergence between `SUPPORTED_CURRENCIES` and the Stripe Connect allow-list
 * derived from it — fails CI in either direction.
 */
describe('Stripe Connect currency allow-list — drift guard', () => {
  // The authoritative 15. If this list changes, that is a deliberate product
  // decision and the assertion below forces it to be made consciously.
  const EXPECTED_15 = [
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
  ]

  it('SUPPORTED_CURRENCIES is exactly the 15 supported codes', () => {
    expect([...SUPPORTED_CURRENCIES].sort()).toEqual([...EXPECTED_15].sort())
  })

  it('the connect allow-list equals the full set (lower-cased), with no divergence either way', () => {
    const expectedLower = new Set(EXPECTED_15.map(c => c.toLowerCase()))

    // (a) every supported currency is connect-enabled
    for (const code of EXPECTED_15) {
      expect(SUPPORTED_CONNECT_CURRENCIES.has(code.toLowerCase())).toBe(true)
    }
    // (b) the connect set has no extras the supported list doesn't
    expect(SUPPORTED_CONNECT_CURRENCIES.size).toBe(expectedLower.size)
    for (const code of SUPPORTED_CONNECT_CURRENCIES) {
      expect(expectedLower.has(code)).toBe(true)
    }
  })
})
