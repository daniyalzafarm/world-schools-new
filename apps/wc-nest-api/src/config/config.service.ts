import { Injectable } from '@nestjs/common'
import { PINNED_STRIPE_API_VERSION } from '../modules/stripe/stripe.constants'
import { requiresPostgresSsl } from './requires-postgres-ssl'

@Injectable()
export class ConfigService {
  private readonly envConfig: { [key: string]: string | undefined }

  constructor() {
    this.envConfig = process.env
    // Set DATABASE_URL for Prisma
    process.env.DATABASE_URL = this.databaseUrl
  }

  get appUrl(): string {
    return this.getString('APP_URL', 'http://localhost:3000')
  }

  get superadminPortalUrl(): string {
    return this.getString('SUPERADMIN_PORTAL_URL', 'http://localhost:4301')
  }

  get providerPortalUrl(): string {
    return this.getString('PROVIDER_PORTAL_URL', 'http://localhost:4302')
  }

  get bookingPortalUrl(): string {
    return this.getString('BOOKING_PORTAL_URL', 'http://localhost:4303')
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development'
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production'
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test'
  }

  get nodeEnv(): string {
    return this.getString('NODE_ENV', 'development')
  }

  get port(): number {
    return this.getNumber('PORT', 3000)
  }

  get databaseUrl(): string {
    const { host, port, username, password, database } = this.postgresConfig
    return `postgresql://${username}:${password}@${host}:${port}/${database}`
  }

  get postgresConfig() {
    return {
      host: this.getString('POSTGRES_HOST', 'localhost'),
      port: this.getNumber('POSTGRES_PORT', 5432),
      username: this.getString('POSTGRES_USER', 'postgres'),
      password: this.getString('POSTGRES_PASSWORD', 'postgres'),
      database: this.getString('POSTGRES_DB', 'world-schools'),
    }
  }

  get postgresRequireSsl(): boolean {
    return requiresPostgresSsl(this.envConfig)
  }

  // JWT Configuration
  get jwtConfig() {
    return {
      secret: this.getString('JWT_SECRET', 'your-fallback-secret-key-change-in-production'),
      expiresIn: this.getString('JWT_EXPIRES_IN', '15m'),
      refreshSecret: this.getString(
        'JWT_REFRESH_SECRET',
        'your-fallback-refresh-secret-key-change-in-production'
      ),
      refreshExpiresIn: this.getString('JWT_REFRESH_EXPIRES_IN', '7d'),
      bcryptSaltRounds: this.getNumber('BCRYPT_SALT_ROUNDS', 12),
      authUsingRequest: this.getString('AUTH_USING_REQUEST', 'false').toLowerCase() === 'true',
    }
  }

  // Security Configuration
  get corsOrigins(): string[] {
    const origins = this.getString('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3001')
    return origins.split(',').map(origin => origin.trim())
  }

  // Email Configuration
  get emailConfig() {
    return {
      host: this.getString('EMAIL_HOST', 'smtp.gmail.com'),
      port: this.getNumber('EMAIL_PORT', 587),
      user: this.getString('EMAIL_USER', ''),
      pass: this.getString('EMAIL_PASS', ''),
      from: this.getString('EMAIL_FROM', 'noreply@worldschools.com'),
    }
  }

  // Azure Storage Configuration
  get azureStorageConfig() {
    return {
      accountUrl: this.getString('AZURE_STORAGE_ACCOUNT_URL', ''),
      accountName: this.getString('AZURE_STORAGE_ACCOUNT_NAME', ''),
      accountKey: this.getString('AZURE_STORAGE_ACCOUNT_KEY', ''),
      containerName: this.getString('AZURE_STORAGE_CONTAINER_NAME', ''),
      sasTokenExpiryHours: this.getNumber('AZURE_STORAGE_SAS_EXPIRY_HOURS', 24),
    }
  }

  // Security Headers
  get isHelmetEnabled(): boolean {
    return this.getString('HELMET_ENABLED', 'true').toLowerCase() === 'true'
  }

  // Trust Proxy Configuration
  get trustProxyConfig(): boolean | number | string | string[] {
    const trustProxy = this.getString('TRUST_PROXY', '')

    if (trustProxy) {
      // Custom configuration via environment variable
      if (trustProxy.toLowerCase() === 'true') return true
      if (trustProxy.toLowerCase() === 'false') return false
      if (/^\d+$/.test(trustProxy)) return parseInt(trustProxy, 10)
      // Handle comma-separated IP addresses/ranges
      if (trustProxy.includes(',')) {
        return trustProxy
          .split(',')
          .map(ip => ip.trim())
          .filter(ip => ip.length > 0)
      }
      return trustProxy.trim()
    }

    // Default configurations based on environment
    if (this.isProduction) {
      return 1 // Trust first proxy (works for most cloud platforms)
    }

    if (this.isDevelopment) {
      return false // No proxy trust in development by default
    }

    // For staging/test environments, trust first proxy
    return 1
  }

  // Google APIs Configuration
  get googlePlacesApiKey(): string {
    return this.getString('GOOGLE_PLACES_API_KEY', '')
  }

  // Stripe Configuration
  //
  // In production all three keys are required and must carry their expected prefixes
  // (live secret/publishable, webhook signing secret) so a misconfigured deploy fails
  // at boot rather than on first Stripe call.
  //
  // In dev/test we keep empty defaults so local boot without Stripe still works, but
  // if a value IS set we still prefix-check it — catches an `sk_live_*` or `sk_test_*`
  // accidentally placed in the wrong env file early.
  get stripeConfig() {
    const isProd = this.isProduction
    const secretKey = isProd
      ? this.getString('STRIPE_SECRET_KEY')
      : this.getString('STRIPE_SECRET_KEY', '')
    const publishableKey = isProd
      ? this.getString('STRIPE_PUBLISHABLE_KEY')
      : this.getString('STRIPE_PUBLISHABLE_KEY', '')
    const webhookSecret = isProd
      ? this.getString('STRIPE_WEBHOOK_SECRET')
      : this.getString('STRIPE_WEBHOOK_SECRET', '')
    // Direct Charges: Connect-account events (`payment_intent.*`, `charge.*`,
    // `charge.dispute.*`, `refund.*`, etc.) deliver to a separate endpoint
    // with its own signing secret. Configured in the Stripe dashboard under
    // "Listen to events on Connect applications".
    const connectWebhookSecret = isProd
      ? this.getString('STRIPE_CONNECT_WEBHOOK_SECRET')
      : this.getString('STRIPE_CONNECT_WEBHOOK_SECRET', '')

    if (isProd) {
      if (!secretKey.startsWith('sk_live_')) {
        throw new Error(
          'Config error - STRIPE_SECRET_KEY must be a live key (sk_live_*) in production'
        )
      }
      if (!publishableKey.startsWith('pk_live_')) {
        throw new Error(
          'Config error - STRIPE_PUBLISHABLE_KEY must be a live key (pk_live_*) in production'
        )
      }
      if (!webhookSecret.startsWith('whsec_')) {
        throw new Error(
          'Config error - STRIPE_WEBHOOK_SECRET must be a Stripe signing secret (whsec_*)'
        )
      }
      if (!connectWebhookSecret.startsWith('whsec_')) {
        throw new Error(
          'Config error - STRIPE_CONNECT_WEBHOOK_SECRET must be a Stripe signing secret (whsec_*)'
        )
      }
    } else {
      if (secretKey && !secretKey.startsWith('sk_')) {
        throw new Error('Config error - STRIPE_SECRET_KEY must start with sk_test_ or sk_live_')
      }
      if (publishableKey && !publishableKey.startsWith('pk_')) {
        throw new Error(
          'Config error - STRIPE_PUBLISHABLE_KEY must start with pk_test_ or pk_live_'
        )
      }
      if (webhookSecret && !webhookSecret.startsWith('whsec_')) {
        throw new Error('Config error - STRIPE_WEBHOOK_SECRET must start with whsec_')
      }
      if (connectWebhookSecret && !connectWebhookSecret.startsWith('whsec_')) {
        throw new Error('Config error - STRIPE_CONNECT_WEBHOOK_SECRET must start with whsec_')
      }
    }

    // H4: Stripe's `webhooks.constructEvent` defaults to a 300-second tolerance
    // for the timestamp portion of the signature. That's fine for a single
    // Container App with NTP-synced clocks, but Stripe retries can sit in a
    // queue for longer in degraded environments. Allow ops to widen the window
    // via env without a code change. Default mirrors Stripe SDK default.
    const webhookToleranceSecondsRaw = this.envConfig['STRIPE_WEBHOOK_TOLERANCE_SECONDS']
    const webhookToleranceSeconds = webhookToleranceSecondsRaw
      ? parseInt(webhookToleranceSecondsRaw, 10)
      : 300
    if (Number.isNaN(webhookToleranceSeconds) || webhookToleranceSeconds < 0) {
      throw new Error(
        'Config error - STRIPE_WEBHOOK_TOLERANCE_SECONDS must be a non-negative integer'
      )
    }
    // H2 audit fix: tighten the cap from 86400s (1 day) to 3600s (1 hour).
    // The previous ceiling was wide enough that a leaked webhook signing
    // secret could be replayed against day-old payloads — long enough for
    // an attacker to find and exploit a leak. 1 hour is generous for any
    // realistic ingress queue / proxy buffering scenario while keeping the
    // replay window narrow enough that even a compromised secret has a
    // tight forensic window. Stripe's own production guidance is 5 minutes
    // (300s) of tolerance — we sit above that to accommodate occasional
    // queue back-pressure, but we will not bypass replay protection.
    if (webhookToleranceSeconds > 3600) {
      throw new Error(
        'Config error - STRIPE_WEBHOOK_TOLERANCE_SECONDS must be ≤ 3600 (1 hour); larger values defeat replay protection'
      )
    }

    // H1: retention horizon for the `StripeWebhookEvent` dedup table. Rows
    // older than this are deleted by the webhook-event-retention cron so the
    // table doesn't grow unbounded. Default 90 days covers Stripe's longest
    // retry horizon plus comfortable ops slack for post-mortem queries.
    const webhookEventRetentionDays = this.getOptionalNonNegativeInt(
      'STRIPE_WEBHOOK_EVENT_RETENTION_DAYS',
      90
    )

    return {
      secretKey,
      publishableKey,
      webhookSecret,
      connectWebhookSecret,
      apiVersion: PINNED_STRIPE_API_VERSION,
      webhookToleranceSeconds,
      webhookEventRetentionDays,
    }
  }

  /**
   * Deployed app version, sourced from `APP_VERSION` (set by the staging /
   * production deploy pipeline from the `wc-v*.*.*` git tag — see
   * `.github/workflows/wc-staging-deploy.yml`). Falls back to `'dev'` for
   * local boots so log enrichment / Stripe `appInfo` always have a value.
   */
  get appVersion(): string {
    return this.getString('APP_VERSION', 'dev')
  }

  /**
   * Off-session balance-charge cron behavior. Pulled from env so a future
   * commercial negotiation ("3 retries on this contract") doesn't need a
   * code deploy. Defaults match the original hardcoded values so existing
   * environments behave identically without any env changes.
   *
   * - `maxAttempts`: total off-session attempts before terminal failure
   * - `retryHours`: spacing between attempts on a soft decline
   * - `stepUpWindowHours`: how long a `requires_action` row may sit before
   *   `markStepUpAbandoned` cancels the intent and marks the row terminal
   * - `cronIntervalMinutes`: pickup cadence (the `@Cron` decorator on
   *   `BalanceChargeCron.run` reads this; if you change here you must keep
   *   the decorator literal in sync — Nest schedule decorators don't accept
   *   dynamic values)
   * - `authExpiryWarnDays` / `authExpiryCancelDays`: the auth-window monitor
   *   (B9) emails providers when a deposit auth is approaching the 7-day
   *   card-brand auth-window cliff and force-cancels just before the void
   */
  get billingConfig() {
    const maxAttempts = this.getOptionalNonNegativeInt('BILLING_OFF_SESSION_MAX_ATTEMPTS', 2)
    const retryHours = this.getOptionalNonNegativeInt('BILLING_OFF_SESSION_RETRY_HOURS', 24)
    const stepUpWindowHours = this.getOptionalNonNegativeInt(
      'BILLING_OFF_SESSION_STEP_UP_WINDOW_HOURS',
      48
    )
    const cronIntervalMinutes = this.getOptionalNonNegativeInt(
      'BILLING_BALANCE_CHARGE_CRON_MINUTES',
      30
    )
    const authExpiryWarnDays = this.getOptionalNonNegativeInt('BILLING_AUTH_EXPIRY_WARN_DAYS', 5)
    // Default 6 days — comfortably inside the 7-day card-brand auth window
    // (Visa/MC/Amex/Discover all 7 days CIT) so we cancel before Stripe voids.
    const authExpiryCancelDays = this.getOptionalNonNegativeInt(
      'BILLING_AUTH_EXPIRY_CANCEL_DAYS',
      6
    )

    if (authExpiryCancelDays >= 7) {
      throw new Error(
        'Config error - BILLING_AUTH_EXPIRY_CANCEL_DAYS must be < 7 (card-brand auth window)'
      )
    }
    if (authExpiryWarnDays >= authExpiryCancelDays) {
      throw new Error(
        'Config error - BILLING_AUTH_EXPIRY_WARN_DAYS must be < BILLING_AUTH_EXPIRY_CANCEL_DAYS'
      )
    }

    return {
      maxAttempts,
      retryHours,
      stepUpWindowHours,
      cronIntervalMinutes,
      authExpiryWarnDays,
      authExpiryCancelDays,
    }
  }

  private getOptionalNonNegativeInt(key: string, defaultValue: number): number {
    const raw = this.envConfig[key]
    if (raw === undefined || raw === '') return defaultValue
    const parsed = parseInt(raw, 10)
    if (Number.isNaN(parsed) || parsed < 0) {
      throw new Error(`Config error - ${key} must be a non-negative integer`)
    }
    return parsed
  }

  // Helper methods for auth controller
  getNodeEnv(): string {
    return this.nodeEnv
  }

  getJwtExpiresIn(): string {
    return this.jwtConfig.expiresIn
  }

  getJwtRefreshExpiresIn(): string {
    return this.jwtConfig.refreshExpiresIn
  }

  public getString(key: string, defaultValue?: string): string {
    const value = this.envConfig[key]
    if (!value && defaultValue === undefined) {
      throw new Error(`Config error - missing ${key}`)
    }
    return (value ?? defaultValue) as string
  }

  private getNumber(key: string, defaultValue?: number): number {
    const value = this.envConfig[key]
    if (!value && defaultValue === undefined) {
      throw new Error(`Config error - missing ${key}`)
    }
    const parsedValue = value ? parseInt(value, 10) : defaultValue
    if (parsedValue === undefined || isNaN(parsedValue)) {
      throw new Error(`Config error - ${key} is not a number`)
    }
    return parsedValue
  }
}
