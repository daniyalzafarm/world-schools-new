import { PROVIDER_IMPORT_COLUMNS } from '@world-schools/wc-types'
import {
  isStrongPassword,
  STRONG_PASSWORD_MESSAGE,
} from '../../../common/validators/is-strong-password.validator'

const REQUIRED_KEYS = PROVIDER_IMPORT_COLUMNS.filter(c => c.required).map(c => c.key)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validates a raw CSV row against the required column definitions and email format.
 * Returns an error message string on failure, or null when the row is valid.
 */
export function validateProviderCsvRow(row: Record<string, string>): string | null {
  for (const key of REQUIRED_KEYS) {
    if (!row[key]?.trim()) {
      return `Missing required field: ${key}`
    }
  }

  const email = row['email']?.trim() ?? ''
  if (!EMAIL_REGEX.test(email)) {
    return `Invalid email format: ${email}`
  }

  if (!isStrongPassword(row['password'] ?? '')) {
    return STRONG_PASSWORD_MESSAGE
  }

  return null
}

export interface ParsedProviderRow {
  // Required
  email: string
  password: string
  firstName: string
  lastName: string
  jobTitle: string
  phoneNumber: string
  // GBP / legal
  googlePlaceId?: string
  legalCompanyName?: string
  yearFounded?: number
  // Settings
  currency: string
  timezone: string
  // Business contact
  providerPhone?: string
  providerEmail?: string
  website?: string
  // Camp profile
  description?: string
  campTypes?: string
  // Deposit & cancellation
  depositRequired?: boolean
  depositType?: string
  depositPercentage?: number
  depositFixedAmount?: number
  cancellationPolicy?: string
}

/**
 * Coerces a validated raw CSV row into strongly-typed values.
 * Only call after validateProviderCsvRow returns null.
 */
export function parseProviderCsvRow(row: Record<string, string>): ParsedProviderRow {
  const str = (key: string): string | undefined => row[key]?.trim() || undefined

  const depositRequiredRaw = row['depositRequired']?.trim()?.toLowerCase()

  return {
    email: row['email'].trim(),
    password: row['password'].trim(),
    firstName: row['firstName'].trim(),
    lastName: row['lastName'].trim(),
    jobTitle: row['jobTitle'].trim(),
    phoneNumber: row['phoneNumber'].trim(),
    googlePlaceId: str('googlePlaceId'),
    legalCompanyName: str('legalCompanyName'),
    yearFounded: row['yearFounded']?.trim() ? parseInt(row['yearFounded'], 10) : undefined,
    currency: str('currency') ?? 'USD',
    timezone: str('timezone') ?? 'America/New_York',
    providerPhone: str('providerPhone'),
    providerEmail: str('providerEmail'),
    website: str('website'),
    description: str('description'),
    campTypes: str('campTypes'),
    depositRequired:
      depositRequiredRaw === 'true' ? true : depositRequiredRaw === 'false' ? false : undefined,
    depositType: str('depositType'),
    depositPercentage: row['depositPercentage']?.trim()
      ? parseInt(row['depositPercentage'], 10)
      : undefined,
    depositFixedAmount: row['depositFixedAmount']?.trim()
      ? parseFloat(row['depositFixedAmount'])
      : undefined,
    cancellationPolicy: str('cancellationPolicy'),
  }
}
