/**
 * Current versions of legal documents
 * Update these constants when terms are revised to require re-acceptance
 */
export const CURRENT_TERMS_VERSION = '1.0'
export const CURRENT_PROVIDER_AGREEMENT_VERSION = '1.0'

/**
 * Effective dates for version tracking
 * Used for audit trails and compliance reporting
 */
export const TERMS_VERSION_DATES = {
  '1.0': '2024-01-03', // Initial version
} as const

export const PROVIDER_AGREEMENT_VERSION_DATES = {
  '1.0': '2024-01-03', // Initial version
} as const

/**
 * Helper function to get the effective date for a terms version
 */
export function getTermsEffectiveDate(version: string): string | undefined {
  return TERMS_VERSION_DATES[version as keyof typeof TERMS_VERSION_DATES]
}

/**
 * Helper function to get the effective date for a provider agreement version
 */
export function getProviderAgreementEffectiveDate(version: string): string | undefined {
  return PROVIDER_AGREEMENT_VERSION_DATES[version as keyof typeof PROVIDER_AGREEMENT_VERSION_DATES]
}
