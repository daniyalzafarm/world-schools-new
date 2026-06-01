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
 * Stripe `tos_acceptance.service_agreement` — explicit policy decision.
 *
 * For our Standard connected accounts created via embedded onboarding, Stripe
 * defaults this to `'full'` (Stripe Services Agreement), which is what we
 * want: providers process card payments as the merchant of record on their
 * own account under Direct Charges, and we collect an `application_fee_amount`
 * per booking. A `'recipient'` agreement applies only to platforms that DON'T
 * let the connected account directly receive card payments (Stripe processes
 * on the platform's behalf and only pays the connected account). That's the
 * opposite of our model — providers' Stripe accounts must be charge-capable
 * so we can issue Direct Charges scoped to their account.
 *
 * We therefore deliberately omit `tos_acceptance.service_agreement` from
 * `accounts.create` and rely on the `'full'` default.
 *
 * Reference: https://stripe.com/connect/service-agreement-types
 */
export const STRIPE_SERVICE_AGREEMENT = 'full' as const

/**
 * Allow-list of currencies the platform officially supports for provider payouts.
 *
 * Restricted to USD / GBP / CHF / EUR per Payments and Payouts Spec v1.0 §3.3:
 * the platform holds bank accounts in exactly these four currencies, wired to
 * the Stripe platform account as external accounts in matching currencies so
 * payouts incur no Stripe FX margin. Any currency outside this set would land
 * in a Stripe balance with no matching WC external account.
 *
 * Currencies are in lower-case to match Stripe's API contract.
 */
export const SUPPORTED_CONNECT_CURRENCIES: ReadonlySet<string> = new Set([
  'usd',
  'gbp',
  'chf',
  'eur',
])
