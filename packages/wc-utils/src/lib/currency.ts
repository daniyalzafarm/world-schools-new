/**
 * Shared currency formatting (frontend + isomorphic utilities).
 *
 * The canonical implementation now lives in `@world-schools/global-utils` so
 * product-agnostic packages (e.g. `ui-web`) can consume it without depending on
 * this World-Camps package. Re-exported here for backward compatibility with
 * the existing `@world-schools/wc-utils` import sites.
 */

export {
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
  formatCurrency,
  getCurrencySymbol,
  getCurrencyName,
} from '@world-schools/global-utils/currency'
