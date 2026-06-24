import { getRuntimeConfig } from './runtime-config'

const config = {
  app: {
    get apiUrl(): string {
      return getRuntimeConfig().apiBaseUrl
    },
    get wsUrl(): string {
      return getRuntimeConfig().wsUrl ?? ''
    },
    get version(): string {
      return getRuntimeConfig().appVersion
    },
    get metadataBase(): string {
      return getRuntimeConfig().appUrl
    },
  },
  auth: {
    get usingRequest(): boolean {
      return getRuntimeConfig().authUsingRequest
    },
  },
  maps: {
    get googleApiKey(): string {
      return getRuntimeConfig().googleMapsApiKey ?? ''
    },
  },
  google: {
    /// Public OAuth client ID for "Sign in with Google". Empty in environments
    /// where Google auth isn't configured — the UI then hides the Google option.
    get oauthClientId(): string {
      return getRuntimeConfig().googleOAuthClientId ?? ''
    },
  },
  stripe: {
    /// Platform Stripe publishable key (`pk_test_…` or `pk_live_…`). Used by
    /// `loadStripe` in [lib/stripe.ts]. For Connect Direct Charges the
    /// connected (provider) account is passed via
    /// `loadStripe(pk, { stripeAccount })` per booking — see
    /// `getStripeForAccount` in [lib/stripe.ts].
    get publishableKey(): string {
      return getRuntimeConfig().stripePublishableKey ?? ''
    },
  },
}

export default config
