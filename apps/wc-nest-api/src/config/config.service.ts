import { Injectable } from '@nestjs/common'
import { PINNED_STRIPE_API_VERSION } from '../modules/stripe/stripe.constants'

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

  get frontendUrl(): string {
    return this.getString('FRONTEND_URL', 'http://localhost:3000')
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

  get storageUrl(): string {
    const url = this.getString('STORAGE_URL', 'http://localhost:3000')
    // Ensure URL ends with a slash for proper path concatenation
    return url.endsWith('/') ? url : `${url}/`
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
    return this.getString('POSTGRES_REQUIRE_SSL', 'false').toLowerCase() === 'true'
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

  get rateLimitWindow(): string {
    return this.getString('RATE_LIMIT_WINDOW', '15m')
  }

  get rateLimitMax(): number {
    return this.getNumber('RATE_LIMIT_MAX', 100)
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

  // File Upload Configuration
  get maxFileSize(): string {
    return this.getString('MAX_FILE_SIZE', '5MB')
  }

  get uploadDest(): string {
    return this.getString('UPLOAD_DEST', './uploads')
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

  // Logging
  get logLevel(): string {
    return this.getString('LOG_LEVEL', 'info')
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
    }

    return {
      secretKey,
      publishableKey,
      webhookSecret,
      apiVersion: PINNED_STRIPE_API_VERSION,
    }
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
