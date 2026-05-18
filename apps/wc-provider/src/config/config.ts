const isProd = process.env.NODE_ENV === 'production'
const required = (value: string | undefined, key: string): string => {
  if (isProd && !value) {
    throw new Error(`Config error - missing ${key}`)
  }
  return value ?? ''
}

const config = {
  app: {
    apiUrl:
      required(process.env.NEXT_PUBLIC_API_BASE_URL, 'NEXT_PUBLIC_API_BASE_URL') ||
      'http://localhost:3000/',
    wsUrl:
      required(process.env.NEXT_PUBLIC_WS_URL, 'NEXT_PUBLIC_WS_URL') || 'http://localhost:3000',
    bookingAppUrl: process.env.NEXT_PUBLIC_BOOKING_APP_BASE_URL ?? 'http://localhost:4303',
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
    superadminAppUrl: process.env.NEXT_PUBLIC_SUPERADMIN_APP_URL ?? 'http://localhost:4100',
    metadataBase:
      required(process.env.NEXT_PUBLIC_APP_URL, 'NEXT_PUBLIC_APP_URL') ||
      'https://provider.world-camps.org',
  },
  auth: {
    usingRequest: process.env.NEXT_PUBLIC_AUTH_USING_REQUEST === 'true',
  },
  stripe: {
    publishableKey: required(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
    ),
    /**
     * H3: Stripe's "Open Dashboard" deep-link differs by mode (live →
     * `dashboard.stripe.com`, test → `dashboard.stripe.com/test`). Connected-
     * account IDs do NOT differ by mode (no `acct_test_` prefix) so the only
     * reliable client-side signal is the publishable-key prefix.
     */
    get isTestMode(): boolean {
      return (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').startsWith('pk_test_')
    },
    /**
     * H3: pre-built dashboard URL the "Open Stripe Dashboard" links should
     * point at. Staging providers land in the test-mode view they actually
     * have access to instead of the empty live dashboard.
     */
    get dashboardUrl(): string {
      return (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').startsWith('pk_test_')
        ? 'https://dashboard.stripe.com/test'
        : 'https://dashboard.stripe.com'
    },
  },
}

export default config
