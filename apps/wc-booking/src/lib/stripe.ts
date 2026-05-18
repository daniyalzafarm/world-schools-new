import { loadStripe, type Stripe } from '@stripe/stripe-js'
import config from '@/config/config'

/**
 * Per-connected-account Stripe.js promise cache.
 *
 * Under Direct Charges (https://docs.stripe.com/connect/direct-charges?platform=web&ui=elements),
 * the connected (provider) account must be set on the **Stripe instance itself**
 * via `loadStripe(pk, { stripeAccount })` — not via Elements options. Routing,
 * branding, and 3DS flow all key off this. Because each provider's account id
 * is distinct, we cache one promise per `stripeAccount` so reloads of the same
 * booking flow share a single `<script>` load and `<Elements>` instance.
 *
 * Per https://docs.stripe.com/js, `loadStripe` MUST be called outside of any
 * render function so the bundle is fetched once per page (not per re-render).
 * The cache below honors that: lazy on first call, then memoized.
 *
 * H11 (Stripe official spec):
 *   "Always load Stripe.js directly from js.stripe.com to remain PCI compliant.
 *    Don't include the script in a bundle."
 * `@stripe/stripe-js`'s `loadStripe` honors this — it dynamically injects a
 * `<script src="https://js.stripe.com/v3/">` tag at first call rather than
 * bundling the Stripe.js library. **Do not "optimize" by importing Stripe.js
 * directly or self-hosting the script — doing so silently moves us out of
 * PCI scope.**
 */
const cache = new Map<string, Promise<Stripe | null>>()

export function getStripeForAccount(stripeAccountId: string): Promise<Stripe | null> {
  if (!stripeAccountId) {
    throw new Error('getStripeForAccount requires a non-empty stripeAccountId')
  }
  const cached = cache.get(stripeAccountId)
  if (cached) return cached

  // H5: `loadStripe` rejects (rather than resolving to null) when the
  // browser blocks `js.stripe.com` (ad-blocker, CSP, regional outage, mobile
  // captive portal). Without the `.catch`, `<Elements stripe={…rejected}>`
  // produces an unhelpful console error and a frozen form. Coercing the
  // rejection to `null` matches the rest of the codebase's "stripe is null
  // → can't take payment" contract, which the booking page renders as a
  // user-facing fallback panel with a refresh CTA.
  const promise = !config.stripe.publishableKey
    ? Promise.resolve<Stripe | null>(null)
    : loadStripe(config.stripe.publishableKey, { stripeAccount: stripeAccountId }).catch(err => {
        console.error('stripe.load_failed', { stripeAccountId, err })
        return null
      })
  cache.set(stripeAccountId, promise)
  return promise
}
