import { getRuntimeConfig } from './runtime-config'

const config = {
  app: {
    get apiUrl(): string {
      return getRuntimeConfig().apiBaseUrl
    },
    get wsUrl(): string {
      return getRuntimeConfig().wsUrl ?? ''
    },
    get bookingAppUrl(): string {
      return getRuntimeConfig().bookingAppUrl ?? 'http://localhost:4303'
    },
    get version(): string {
      return getRuntimeConfig().appVersion
    },
    get superadminAppUrl(): string {
      return getRuntimeConfig().superadminAppUrl ?? 'http://localhost:4100'
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
  stripe: {
    get publishableKey(): string {
      return getRuntimeConfig().stripePublishableKey ?? ''
    },
    /**
     * H3: Stripe's "Open Dashboard" deep-link differs by mode (live →
     * `dashboard.stripe.com`, test → `dashboard.stripe.com/test`). Connected-
     * account IDs do NOT differ by mode (no `acct_test_` prefix) so the only
     * reliable client-side signal is the publishable-key prefix.
     */
    get isTestMode(): boolean {
      return (getRuntimeConfig().stripePublishableKey ?? '').startsWith('pk_test_')
    },
    /**
     * H3: pre-built dashboard URL the "Open Stripe Dashboard" links should
     * point at. Staging providers land in the test-mode view they actually
     * have access to instead of the empty live dashboard.
     */
    get dashboardUrl(): string {
      return (getRuntimeConfig().stripePublishableKey ?? '').startsWith('pk_test_')
        ? 'https://dashboard.stripe.com/test'
        : 'https://dashboard.stripe.com'
    },
  },
}

export default config
