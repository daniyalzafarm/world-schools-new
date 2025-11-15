import { Injectable } from '@nestjs/common'

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

  private getString(key: string, defaultValue?: string): string {
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
