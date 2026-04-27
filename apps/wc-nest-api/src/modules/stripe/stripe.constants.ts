/**
 * The Stripe API version this service is built and tested against.
 *
 * Webhook payload shapes, expanded fields, and enum values are tied to the API version.
 * The installed `stripe` SDK pins one API version per release: when this constant is
 * passed to `new Stripe(...)` the SDK type-checks it against its own `LatestApiVersion`
 * literal, so an SDK bump that moves the version produces a compile-time error here
 * instead of a silent payload-shape drift at runtime.
 *
 * To bump: review https://github.com/stripe/stripe-node/blob/master/CHANGELOG.md for
 * the new version's API-version notes, audit any webhook handlers that read payload
 * fields whose shape changed, then update this constant.
 */
export const PINNED_STRIPE_API_VERSION = '2026-04-22.dahlia' as const

/**
 * Stripe Merchant Category Code (MCC) — `7032: Sporting and Recreational Camps`.
 * Pre-fills the "Industry" field on the embedded onboarding form so providers
 * don't have to pick it themselves. Every provider on this platform is a camp
 * operator, so a single hardcoded value is correct.
 *
 * Reference: https://stripe.com/docs/connect/setting-mcc
 */
export const PROVIDER_MCC = '7032'

/**
 * Allow-list of currencies the platform officially supports for provider payouts.
 *
 * Stripe Connect Express supports many currencies across many countries, but the
 * `default_currency` we set on `accounts.create` MUST be one Stripe accepts for
 * the connected account's country. Sending an unsupported currency surfaces a
 * cryptic 400 from the Stripe API at create time. We pre-validate against this
 * list so providers see a friendly platform-policy error instead.
 *
 * Currencies are in lower-case to match Stripe's API contract.
 *
 * Add new currencies here as the platform expands to new regions.
 */
export const SUPPORTED_CONNECT_CURRENCIES: ReadonlySet<string> = new Set([
  'usd',
  'eur',
  'gbp',
  'cad',
  'aud',
  'nzd',
  'chf',
  'sek',
  'nok',
  'dkk',
  'sgd',
  'hkd',
  'jpy',
])
