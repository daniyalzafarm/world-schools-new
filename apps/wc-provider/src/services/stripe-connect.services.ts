import apiClient, { type ApiResult } from '../utils/api-client'

export interface StripeAddress {
  line1: string | null
  line2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
}

export interface StripeBusinessProfile {
  name: string | null
  url: string | null
  supportEmail: string | null
  supportPhone: string | null
  productDescription: string | null
  mcc: string | null
}

export interface StripeRepresentative {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  dateOfBirth: string | null
  address: StripeAddress | null
  verificationStatus: string | null
}

export interface StripeCompanyInfo {
  name: string | null
  phone: string | null
  taxIdProvided: boolean
  address: StripeAddress | null
}

export interface StripeBankAccount {
  id: string
  type: 'bank_account' | 'card' | 'other'
  bankName: string | null
  last4: string | null
  currency: string
  country: string | null
  accountHolderName: string | null
  routingNumber: string | null
  defaultForCurrency: boolean
  status: string | null
}

export interface StripePayoutSchedule {
  interval: string | null
  delayDays: number | null
  weeklyAnchor: string | null
  monthlyAnchor: number | null
}

export interface StripeAccountStatus {
  hasAccount: boolean
  stripeAccountId: string | null
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  attentionRequired: boolean
  onboardingCompleted: boolean
  onboardingSkippedAt: string | null
  currency: string
  commissionPercentage: number | null
  requirementsCurrentlyDue: string[]
  requirementsPastDue: string[]
  requirementsEventuallyDue: string[]
  disabledReason: string | null
  businessType: string | null
  country: string | null
  accountEmail: string | null
  accountCreatedAt: string | null
  tosAcceptedAt: string | null
  businessProfile: StripeBusinessProfile | null
  representative: StripeRepresentative | null
  company: StripeCompanyInfo | null
  externalAccounts: StripeBankAccount[]
  payoutSchedule: StripePayoutSchedule | null
}

export interface AccountSessionResponse {
  clientSecret: string
}

export const stripeConnectService = {
  /**
   * Creates (or retrieves existing) Stripe Express connected account.
   * Idempotent — safe to call multiple times.
   */
  async createOrGetAccount(): Promise<ApiResult<StripeAccountStatus>> {
    return await apiClient.post<StripeAccountStatus>('/provider/stripe-connect/account', {})
  },

  /**
   * Returns current Stripe account status. Resolves with `hasAccount: false` when
   * the provider hasn't created a Stripe account yet — does not error in that case.
   */
  async getAccountStatus(): Promise<ApiResult<StripeAccountStatus>> {
    return await apiClient.get<StripeAccountStatus>('/provider/stripe-connect/account')
  },

  /**
   * Creates a single-use AccountSession client_secret for the embedded onboarding component.
   * Must be called fresh each time — do not cache the result.
   */
  async createAccountSession(): Promise<ApiResult<AccountSessionResponse>> {
    return await apiClient.post<AccountSessionResponse>(
      '/provider/stripe-connect/account-session',
      {}
    )
  },

  /**
   * Records the embedded onboarding's onExit. The backend syncs the live Stripe
   * snapshot and finalizes (sets `onboardingCompleted`) only when Stripe reports
   * `details_submitted: true`. Otherwise it persists a skip timestamp so the
   * provider can return and resume — read `result.data.onboardingCompleted` to
   * route accordingly.
   */
  async completeOnboarding(): Promise<ApiResult<StripeAccountStatus>> {
    return await apiClient.post<StripeAccountStatus>('/provider/stripe-connect/complete', {})
  },

  /**
   * Marks Stripe onboarding as skipped — provider can finish later from the
   * dashboard's Stripe Account page.
   */
  async skipOnboarding(): Promise<ApiResult<StripeAccountStatus>> {
    return await apiClient.post<StripeAccountStatus>('/provider/stripe-connect/skip', {})
  },

  /**
   * Generates a single-use URL into the provider's Stripe Express dashboard.
   * The URL is short-lived (a few minutes) — do not cache it; request fresh on every click.
   */
  async createLoginLink(): Promise<ApiResult<{ url: string }>> {
    return await apiClient.post<{ url: string }>('/provider/stripe-connect/login-link', {})
  },
}
